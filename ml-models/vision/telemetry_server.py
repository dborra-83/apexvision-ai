"""
ApexVision AI — Multi-Simulator Telemetry Server
=================================================
Unified entry point supporting: iRacing, F1 2024/2025, Assetto Corsa, ACC.

Usage:
  python telemetry_server.py                      # Default: iRacing
  python telemetry_server.py --simulator f1       # F1 2024/2025
  python telemetry_server.py --simulator ac       # Assetto Corsa
  python telemetry_server.py --simulator acc      # ACC
  python telemetry_server.py --auto-detect        # Try all, use first found
"""
import asyncio
import argparse
import json
import time
import socket
import sys
import traceback
import os
from pathlib import Path
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading
import urllib.parse

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from connectors import get_connector, CONNECTOR_REGISTRY
from connectors.base import BaseConnector
from connectors.registry import AUTO_DETECT_ORDER
from schema.serializer import to_json

try:
    from websockets.server import serve
    from websockets.client import connect as ws_connect
except ImportError:
    print("ERROR: pip install websockets")
    sys.exit(1)

# ============================================================
# CONFIG
# ============================================================
WS_PORT = 8765
HTTP_PORT = 8766
SAMPLE_RATE_HZ = 10
SESSIONS_DIR = Path("./sessions")

# ============================================================
# GLOBALS
# ============================================================
clients: set = set()
session_dir: Path | None = None
laps_file = None
events_file = None
lap_summaries: list = []
current_lap_data: list = []
current_lap_num = 0
session_info_saved = False
sample_counter = 0

# Gateway client state
gateway_ws = None
gateway_connected = False


# ============================================================
# SESSION RECORDING
# ============================================================
def init_session_logging(track_name: str, driver_name: str, simulator: str):
    global session_dir, laps_file, events_file, lap_summaries, session_info_saved
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_track = "".join(c if c.isalnum() or c in '-_ ' else '' for c in (track_name or 'unknown')).strip().replace(' ', '_')
    safe_driver = "".join(c if c.isalnum() or c in '-_ ' else '' for c in (driver_name or 'unknown')).strip().replace(' ', '_')
    session_dir = SESSIONS_DIR / f"{ts}_{safe_driver}_{safe_track}"
    session_dir.mkdir(parents=True, exist_ok=True)
    laps_file = open(session_dir / "laps.jsonl", "a", encoding="utf-8")
    events_file = open(session_dir / "events.jsonl", "a", encoding="utf-8")
    lap_summaries = []
    session_info_saved = False
    print(f"[LOG] Recording to: {session_dir}")


def log_sample(data: dict):
    global sample_counter
    if laps_file and data.get('isOnTrack'):
        sample_counter += 1
        if sample_counter % 1 == 0:
            laps_file.write(json.dumps(data) + "\n")


def log_event(event_type: str, data: dict, message: str = ""):
    if events_file:
        evt = {"type": event_type, "timestamp": time.time(), "message": message, **data}
        events_file.write(json.dumps(evt) + "\n")
        events_file.flush()


def save_lap_summary(lap_num: int, lap_data: list):
    global lap_summaries
    if not lap_data:
        return
    speeds = [d.get('speed', 0) for d in lap_data if d.get('speed')]
    fuels = [d.get('fuelPercent', 0) for d in lap_data if d.get('fuelPercent') is not None]
    summary = {
        "lap": lap_num,
        "lapTime": lap_data[-1].get('lastLapTime', 0) if len(lap_data) > 1 else 0,
        "maxSpeed": max(speeds) if speeds else 0,
        "avgSpeed": round(sum(speeds) / len(speeds), 1) if speeds else 0,
        "fuelUsed": round(fuels[0] - fuels[-1], 2) if len(fuels) > 1 else 0,
        "samples": len(lap_data),
        "offTracks": sum(1 for d in lap_data if d.get('isOffTrack')),
        "maxGLat": max(abs(d.get('gLateral', 0) or 0) for d in lap_data),
    }
    lap_summaries.append(summary)
    if session_dir:
        with open(session_dir / "lap_summaries.json", "w", encoding="utf-8") as f:
            json.dump(lap_summaries, f, indent=2)
    print(f"  [LAP {lap_num}] {summary['lapTime']:.3f}s | Max: {summary['maxSpeed']:.0f} km/h")


def save_session_info(data: dict, simulator: str):
    global session_info_saved
    if session_dir and not session_info_saved:
        info = {
            "startTime": datetime.now().isoformat(),
            "simulator": simulator,
            "driver": data.get("driverName", ""),
            "car": data.get("carName", ""),
            "track": data.get("trackName", ""),
            "trackConfig": data.get("trackConfig", ""),
            "sessionName": data.get("sessionName", ""),
            "airTemp": data.get("airTemp", 0),
            "trackTemp": data.get("trackTemp", 0),
        }
        with open(session_dir / "session_info.json", "w", encoding="utf-8") as f:
            json.dump(info, f, indent=2)
        session_info_saved = True


def close_session():
    global laps_file, events_file
    if laps_file:
        laps_file.close()
        laps_file = None
    if events_file:
        events_file.close()
        events_file = None
    # S3 upload
    if session_dir and session_dir.exists():
        try:
            import boto3
            bucket = os.environ.get('APEXVISION_S3_BUCKET', 'apexvision-sessions-520754296204')
            s3 = boto3.client('s3', region_name=os.environ.get('AWS_DEFAULT_REGION', 'us-east-1'))
            prefix = f"sessions/{session_dir.name}"
            for fp in session_dir.iterdir():
                if fp.is_file():
                    s3.upload_file(str(fp), bucket, f"{prefix}/{fp.name}")
            print(f"[S3] ✓ Uploaded to s3://{bucket}/{prefix}/")
        except ImportError:
            print("[S3] boto3 not installed — session saved locally only")
        except Exception as e:
            print(f"[S3] Upload failed: {e}")


# ============================================================
# HTTP API
# ============================================================
class SessionsAPIHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path == '/api/sessions':
            self._list_sessions()
        elif path.startswith('/api/sessions/'):
            self._get_file(path)
        else:
            self.send_error(404)

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def _list_sessions(self):
        sessions = []
        if SESSIONS_DIR.exists():
            for folder in sorted(SESSIONS_DIR.iterdir(), reverse=True):
                if folder.is_dir():
                    info = {}
                    info_file = folder / "session_info.json"
                    if info_file.exists():
                        try:
                            info = json.loads(info_file.read_text(encoding='utf-8'))
                        except Exception:
                            pass
                    sessions.append({
                        "name": folder.name, "driver": info.get("driver", ""),
                        "car": info.get("car", ""), "track": info.get("track", ""),
                        "date": info.get("startTime", ""), "sessionName": info.get("sessionName", ""),
                        "simulator": info.get("simulator", "unknown"),
                    })
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self._cors()
        self.end_headers()
        self.wfile.write(json.dumps(sessions).encode())

    def _get_file(self, path: str):
        parts = path.replace('/api/sessions/', '').split('/')
        if len(parts) != 2 or '..' in parts[0] or '..' in parts[1]:
            self.send_error(400)
            return
        file_path = SESSIONS_DIR / parts[0] / parts[1]
        if not file_path.exists():
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self._cors()
        self.end_headers()
        self.wfile.write(file_path.read_text(encoding='utf-8').encode())

    def log_message(self, format, *args):
        pass


# ============================================================
# WEBSOCKET + BROADCAST
# ============================================================
async def ws_handler(ws):
    clients.add(ws)
    try:
        await ws.wait_closed()
    except Exception:
        pass
    finally:
        clients.discard(ws)


async def broadcast(connector: BaseConnector, driver_id: int = 0):
    global current_lap_num, current_lap_data, session_dir

    sim = connector.simulator_name
    off_track_cooldown = 0

    while True:
        try:
            data = connector.read_telemetry()
            if not data:
                await asyncio.sleep(1.0 / SAMPLE_RATE_HZ)
                continue

            # Init recording
            if data.get('isOnTrack') and session_dir is None:
                init_session_logging(data.get('trackName', 'unknown'), data.get('driverName', 'unknown'), sim)

            if session_dir and data.get('driverName'):
                save_session_info(data, sim)

            # Lap tracking
            lap = data.get('lap', 0)
            if lap > 0 and lap != current_lap_num:
                if current_lap_num > 0 and current_lap_data:
                    save_lap_summary(current_lap_num, current_lap_data)
                current_lap_num = lap
                current_lap_data = []

            if data.get('isOnTrack'):
                current_lap_data.append(data)

            # Events
            now = time.time()
            if data.get('isOffTrack') and now > off_track_cooldown:
                pct = data.get('lapDistPct', 0)
                log_event("off_track", {"lap": lap, "trackPct": pct, "speed": data.get('speed', 0)},
                          f"Off track @ {pct:.0f}% lap {lap}")
                off_track_cooldown = now + 3

            log_sample(data)

            # Broadcast to local WS clients
            if clients:
                msg = to_json(data)
                dead = set()
                for c in list(clients):
                    try:
                        await c.send(msg)
                    except Exception:
                        dead.add(c)
                clients.difference_update(dead)

            # Forward to API Gateway (non-blocking)
            if driver_id > 0 and gateway_connected:
                await send_to_gateway(data, driver_id)

        except Exception as e:
            print(f"[ERR] {e}")
            traceback.print_exc()

        await asyncio.sleep(1.0 / SAMPLE_RATE_HZ)


# ============================================================
# AUTO-DETECT
# ============================================================
def auto_detect() -> BaseConnector | None:
    """Try each connector, return the first one that connects."""
    for sim_id in AUTO_DETECT_ORDER:
        try:
            conn = get_connector(sim_id)
            conn.connect()
            print(f"[AUTO] Detected: {sim_id}")
            return conn
        except ConnectionError:
            continue
    return None


# ============================================================
# GATEWAY WSS CLIENT (Phase 3 — Multi-Driver Architecture)
# ============================================================
async def gateway_client(gateway_url: str, driver_id: int, api_key: str, connector: BaseConnector):
    """
    Non-blocking WSS client that forwards telemetry to the API Gateway.
    Reconnects with exponential backoff (1s → 30s cap) if connection drops.
    Does NOT affect local WS broadcast — if this fails, local continues.
    """
    global gateway_ws, gateway_connected

    backoff = 1.0
    max_backoff = 30.0

    # Build connection URL with query params
    separator = '&' if '?' in gateway_url else '?'
    connect_url = f"{gateway_url}{separator}apiKey={api_key}&driverId={driver_id}&clientType=simulator"

    print(f"[GW] Gateway mode enabled — driver {driver_id}")
    print(f"[GW] Target: {gateway_url}")

    while True:
        try:
            async with ws_connect(connect_url, open_timeout=10, close_timeout=5) as ws:
                gateway_ws = ws
                gateway_connected = True
                backoff = 1.0  # Reset backoff on successful connect
                print(f"[GW] ✓ Connected to gateway (driver {driver_id})")

                # Keep alive — read messages (pings/pongs handled by library)
                async for msg in ws:
                    # Gateway may send control messages; log but don't act
                    try:
                        parsed = json.loads(msg)
                        if parsed.get("type") == "error":
                            print(f"[GW] Server error: {parsed.get('message', msg)}")
                    except (json.JSONDecodeError, TypeError):
                        pass

        except asyncio.CancelledError:
            print("[GW] Gateway client cancelled")
            gateway_connected = False
            gateway_ws = None
            return
        except Exception as e:
            gateway_connected = False
            gateway_ws = None
            print(f"[GW] Connection lost: {e} — reconnecting in {backoff:.1f}s")
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, max_backoff)


async def send_to_gateway(data: dict, driver_id: int):
    """Send a telemetry frame to the gateway if connected. Non-blocking, fire-and-forget."""
    global gateway_ws, gateway_connected

    if not gateway_connected or gateway_ws is None:
        return

    try:
        payload = json.dumps({
            "action": "telemetry",
            "driverId": driver_id,
            "data": data,
        })
        await gateway_ws.send(payload)
    except Exception:
        # Don't crash broadcast loop — gateway will reconnect on its own
        gateway_connected = False
        gateway_ws = None


# ============================================================
# MAIN
# ============================================================
def get_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


async def main(connector: BaseConnector, driver_id: int = 0, gateway_url: str = "", api_key: str = ""):
    ip = get_ip()
    sim = connector.simulator_name

    # Start HTTP API
    http_server = HTTPServer(('0.0.0.0', HTTP_PORT), SessionsAPIHandler)
    threading.Thread(target=http_server.serve_forever, daemon=True).start()

    print("=" * 58)
    print("  ApexVision AI — Multi-Sim Telemetry Server")
    print("=" * 58)
    print(f"  Simulator:  {sim.upper()}")
    print(f"  WebSocket:  ws://{ip}:{WS_PORT}")
    print(f"  Sessions:   http://{ip}:{HTTP_PORT}/api/sessions")
    print(f"  Dashboard:  http://localhost:5173/live")
    print(f"  Rate:       {SAMPLE_RATE_HZ} Hz")
    print(f"  Recording:  {SESSIONS_DIR}/")
    if driver_id > 0:
        print(f"  Driver ID:  {driver_id}")
    if gateway_url:
        print(f"  Gateway:    {gateway_url}")
    print("=" * 58)

    try:
        async with serve(ws_handler, "0.0.0.0", WS_PORT):
            tasks = [asyncio.create_task(broadcast(connector, driver_id))]

            # Start gateway client alongside broadcast if configured
            if gateway_url and api_key and driver_id > 0:
                tasks.append(asyncio.create_task(
                    gateway_client(gateway_url, driver_id, api_key, connector)
                ))

            await asyncio.gather(*tasks)
    finally:
        if current_lap_num > 0 and current_lap_data:
            save_lap_summary(current_lap_num, current_lap_data)
        close_session()
        connector.disconnect()
        print(f"\n[FIN] Session saved. Simulator: {sim}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ApexVision AI — Multi-Sim Telemetry Server")
    parser.add_argument("--simulator", "-s", choices=list(CONNECTOR_REGISTRY.keys()), default="iracing",
                        help="Which simulator to connect to (default: iracing)")
    parser.add_argument("--auto-detect", action="store_true",
                        help="Try each connector in sequence, activate the first that connects")
    # Phase 3: Multi-driver gateway mode
    parser.add_argument("--driver", type=int, choices=[1, 2, 3, 4], default=0,
                        help="Driver ID (1-4) for this PC in multi-driver mode")
    parser.add_argument("--gateway", type=str, default="",
                        help="WSS URL of the API Gateway (e.g. wss://xxx.execute-api.us-east-1.amazonaws.com/prod)")
    parser.add_argument("--api-key", type=str, default="",
                        help="Team API key for gateway authentication")
    args = parser.parse_args()

    connector = None

    if args.auto_detect:
        print("[AUTO] Detecting running simulator...")
        connector = auto_detect()
        while connector is None:
            print("[AUTO] No simulator detected. Retrying in 10s... (Start one of: iRacing, F1, AC, ACC)")
            time.sleep(10)
            connector = auto_detect()
    else:
        connector = get_connector(args.simulator)
        print(f"[{args.simulator.upper()}] Connecting...")
        try:
            connector.connect()
        except ConnectionError as e:
            print(f"[{args.simulator.upper()}] {e}")
            print(f"[{args.simulator.upper()}] Waiting for simulator... (retry every 5s)")
            while True:
                time.sleep(5)
                try:
                    connector.connect()
                    break
                except ConnectionError:
                    continue

    # Validate gateway args
    if args.gateway and not args.driver:
        print("[WARN] --gateway requires --driver (1-4). Gateway mode disabled.")
    if args.gateway and not args.api_key:
        print("[WARN] --gateway requires --api-key. Gateway mode disabled.")

    asyncio.run(main(
        connector,
        driver_id=args.driver,
        gateway_url=args.gateway if args.driver and args.api_key else "",
        api_key=args.api_key,
    ))
