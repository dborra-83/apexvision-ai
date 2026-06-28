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


async def broadcast(connector: BaseConnector):
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

            # Broadcast
            if clients:
                msg = to_json(data)
                dead = set()
                for c in list(clients):
                    try:
                        await c.send(msg)
                    except Exception:
                        dead.add(c)
                clients.difference_update(dead)

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


async def main(connector: BaseConnector):
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
    print("=" * 58)

    try:
        async with serve(ws_handler, "0.0.0.0", WS_PORT):
            await broadcast(connector)
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

    asyncio.run(main(connector))
