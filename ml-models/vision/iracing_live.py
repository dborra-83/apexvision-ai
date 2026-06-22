"""
ApexVision AI - iRacing Live Telemetry Server v3 (Unified)
==========================================================
Un solo script que:
  1. Lee telemetría de iRacing en tiempo real (10 Hz)
  2. Broadcast via WebSocket a clientes (dashboard)
  3. Guarda registros completos en disco (JSON lines por vuelta + resumen de sesión)

Registros guardados en: ./sessions/<timestamp>_<track>/
  - session_info.json  → metadata de sesión
  - laps.jsonl         → 1 línea JSON por sample (10Hz), separado por vuelta
  - lap_summaries.json → resumen por vuelta (tiempo, max speed, fuel, etc.)
  - events.jsonl       → eventos (off-track, incidentes, banderas)

Uso: python iracing_live.py
"""
import asyncio
import json
import time
import socket
import traceback
import os
import math
from datetime import datetime
from pathlib import Path

try:
    import irsdk
except ImportError:
    print("ERROR: pip install pyirsdk")
    exit(1)

try:
    import websockets
    from websockets.server import serve
except ImportError:
    print("ERROR: pip install websockets")
    exit(1)

# ============================================================
# CONFIG
# ============================================================
WS_PORT = 8765
HTTP_PORT = 8766  # HTTP API for session data
SAMPLE_RATE_HZ = 10
LOG_EVERY_N_SAMPLES = 1  # Log every sample (10Hz). Set to 5 for 2Hz logging.

# ============================================================
# GLOBALS
# ============================================================
ir = irsdk.IRSDK()
clients: set = set()
ir_connected = False

# Session logging
session_dir: Path | None = None
laps_file = None
events_file = None
lap_summaries: list = []
current_lap_data: list = []
current_lap_num = 0
session_info_saved = False
sample_counter = 0


# ============================================================
# HELPERS
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


def init_session_logging(track_name: str, driver_name: str):
    """Crea la carpeta de sesión y abre archivos de log."""
    global session_dir, laps_file, events_file, lap_summaries, session_info_saved
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_track = "".join(c if c.isalnum() or c in '-_ ' else '' for c in (track_name or 'unknown')).strip().replace(' ', '_')
    safe_driver = "".join(c if c.isalnum() or c in '-_ ' else '' for c in (driver_name or 'unknown')).strip().replace(' ', '_')
    session_dir = Path(f"./sessions/{ts}_{safe_driver}_{safe_track}")
    session_dir.mkdir(parents=True, exist_ok=True)
    laps_file = open(session_dir / "laps.jsonl", "a", encoding="utf-8")
    events_file = open(session_dir / "events.jsonl", "a", encoding="utf-8")
    lap_summaries = []
    session_info_saved = False
    print(f"[LOG] Session dir: {session_dir}")


def log_sample(data: dict):
    """Escribe un sample de telemetría al archivo de vueltas."""
    global laps_file, sample_counter
    if laps_file and data.get('isOnTrack'):
        sample_counter += 1
        if sample_counter % LOG_EVERY_N_SAMPLES == 0:
            laps_file.write(json.dumps(data) + "\n")


def log_event(event_type: str, data: dict, message: str = ""):
    """Escribe un evento al log."""
    if events_file:
        evt = {"type": event_type, "timestamp": time.time(), "message": message, **data}
        events_file.write(json.dumps(evt) + "\n")
        events_file.flush()


def save_lap_summary(lap_num: int, lap_data: list):
    """Calcula y guarda el resumen de una vuelta."""
    global lap_summaries
    if not lap_data:
        return
    speeds = [d.get('speed', 0) for d in lap_data]
    fuels = [d.get('fuelPercent', 0) for d in lap_data]
    summary = {
        "lap": lap_num,
        "lapTime": lap_data[-1].get('lastLapTime', 0) if len(lap_data) > 1 else 0,
        "maxSpeed": max(speeds) if speeds else 0,
        "avgSpeed": round(sum(speeds) / len(speeds), 1) if speeds else 0,
        "minSpeed": min(speeds) if speeds else 0,
        "fuelStart": fuels[0] if fuels else 0,
        "fuelEnd": fuels[-1] if fuels else 0,
        "fuelUsed": round(fuels[0] - fuels[-1], 2) if len(fuels) > 1 else 0,
        "samples": len(lap_data),
        "offTracks": sum(1 for d in lap_data if d.get('isOffTrack')),
        "maxGLat": max(abs(d.get('gLateral', 0)) for d in lap_data),
        "maxGLon": max(abs(d.get('gLongitudinal', 0)) for d in lap_data),
        "maxBrake": max(d.get('brake', 0) for d in lap_data),
        "incidents": lap_data[-1].get('incidentCount', 0),
    }
    lap_summaries.append(summary)
    # Save to disk
    if session_dir:
        with open(session_dir / "lap_summaries.json", "w", encoding="utf-8") as f:
            json.dump(lap_summaries, f, indent=2)
    print(f"  [LAP {lap_num}] {summary['lapTime']:.3f}s | Max: {summary['maxSpeed']:.0f} km/h | Fuel: -{summary['fuelUsed']:.1f}%")


def save_session_info(data: dict):
    """Guarda metadata de la sesión."""
    global session_info_saved
    if session_dir and not session_info_saved:
        info = {
            "startTime": datetime.now().isoformat(),
            "driver": data.get("driverName", ""),
            "driverID": data.get("driverID", 0),
            "iRating": data.get("driverIRating", 0),
            "license": data.get("driverLicense", ""),
            "car": data.get("carName", ""),
            "carNumber": data.get("carNumber", ""),
            "carClass": data.get("carClass", ""),
            "track": data.get("trackName", ""),
            "trackConfig": data.get("trackConfig", ""),
            "trackLength": data.get("trackLength", ""),
            "sessionName": data.get("sessionName", ""),
            "airTemp": data.get("airTemp", 0),
            "trackTemp": data.get("trackTemp", 0),
        }
        with open(session_dir / "session_info.json", "w", encoding="utf-8") as f:
            json.dump(info, f, indent=2)
        session_info_saved = True


def close_session_logging():
    """Cierra archivos de log y sube a S3 si está configurado."""
    global laps_file, events_file
    if laps_file:
        laps_file.close()
        laps_file = None
    if events_file:
        events_file.close()
        events_file = None

    # Upload to S3
    if session_dir and session_dir.exists():
        upload_to_s3(session_dir)


def upload_to_s3(local_dir: Path):
    """Sube los archivos de sesión a S3. Requiere boto3 y credenciales AWS configuradas."""
    bucket_name = os.environ.get('APEXVISION_S3_BUCKET', 'apexvision-sessions-520754296204')
    region = os.environ.get('AWS_DEFAULT_REGION', 'us-east-1')

    try:
        import boto3
    except ImportError:
        print("[S3] boto3 no instalado — sesión guardada solo localmente.")
        print("     Para habilitar S3: pip install boto3")
        return

    try:
        s3 = boto3.client('s3', region_name=region)
        prefix = f"sessions/{local_dir.name}"

        files_uploaded = 0
        for file_path in local_dir.iterdir():
            if file_path.is_file():
                key = f"{prefix}/{file_path.name}"
                s3.upload_file(str(file_path), bucket_name, key)
                files_uploaded += 1

        print(f"[S3] ✓ Sesión subida: s3://{bucket_name}/{prefix}/ ({files_uploaded} archivos)")
    except Exception as e:
        print(f"[S3] ⚠ Error al subir: {e}")
        print("     La sesión se guardó localmente en:", local_dir)


# ============================================================
# TELEMETRY READER
# ============================================================
def safe_read():
    """Lee telemetria de iRacing de forma segura. Retorna dict o None."""
    global ir_connected
    try:
        if not ir.is_connected:
            if ir.startup():
                ir_connected = True
                print("[OK] Conectado a iRacing")
            else:
                ir_connected = False
                return {"connected": False, "waiting": True, "timestamp": time.time()}

        speed = ir['Speed']
        if speed is None:
            return {"connected": True, "waiting": True, "noData": True, "timestamp": time.time()}

        data = {
            "connected": True,
            "timestamp": time.time(),
            "speed": round(float(speed) * 3.6, 1),
            "rpm": round(float(ir['RPM'] or 0)),
            "gear": int(ir['Gear'] or 0),  # 0=N, -1=R, 1-8=forward gears
            "throttle": round(float(ir['Throttle'] or 0) * 100),
            "brake": round(float(ir['Brake'] or 0) * 100),
            "clutch": round(float(ir['Clutch'] or 0) * 100),
            "steering": round(float(ir['SteeringWheelAngle'] or 0) * 57.3, 1),
            "lap": int(ir['Lap'] or 0),
            "position": int(ir['PlayerCarPosition'] or 0),
            "classPosition": int(ir['PlayerCarClassPosition'] or 0),
            "lastLapTime": round(float(ir['LapLastLapTime'] or 0), 3),
            "bestLapTime": round(float(ir['LapBestLapTime'] or 0), 3),
            "currentLapTime": round(float(ir['LapCurrentLapTime'] or 0), 3),
            "deltaToSessionBest": round(float(ir['LapDeltaToSessionBestLap'] or 0), 3),
            "fuelLevel": round(float(ir['FuelLevel'] or 0), 2),
            "fuelPercent": round(float(ir['FuelLevelPct'] or 0) * 100, 1),
            "fuelUsePerHour": round(float(ir['FuelUsePerHour'] or 0), 2),
            "fuelLevelLiters": round(float(ir['FuelLevel'] or 0), 2),
            "gLateral": round(float(ir['LatAccel'] or 0), 2),
            "gLongitudinal": round(float(ir['LongAccel'] or 0), 2),
            "trackTemp": round(float(ir['TrackTempCrew'] or 0), 1),
            "airTemp": round(float(ir['AirTemp'] or 0), 1),
            "onPitRoad": bool(ir['OnPitRoad'] or False),
            "isOnTrack": bool(ir['IsOnTrack'] or False),
            "sessionLapsRemaining": int(ir['SessionLapsRemainEx'] or 0),
            "lapDistPct": round(float(ir['LapDistPct'] or 0) * 100, 1),
            "incidentCount": int(ir['PlayerCarMyIncidentCount'] or 0),
            "velocity_x": round(float(ir['VelocityX'] or 0), 2),
            "velocity_y": round(float(ir['VelocityY'] or 0), 2),
            "yawRate": round(float(ir['YawRate'] or 0) * 57.3, 2),
            "shiftIndicator": round(float(ir['ShiftIndicatorPct'] or 0) * 100),
            "engineWarnings": int(ir['EngineWarnings'] or 0),
            "sessionTimeRemaining": round(float(ir['SessionTimeRemain'] or 0), 1),
            "steeringTorque": round(float(ir['SteeringWheelTorque'] or 0), 2),
        }

        # Session info
        try:
            week_info = ir['WeekendInfo']
            if week_info:
                data["trackName"] = week_info.get('TrackDisplayName', '') or week_info.get('TrackName', '')
                data["trackConfig"] = week_info.get('TrackConfigName', '')
                data["trackCity"] = week_info.get('TrackCity', '')
                data["trackCountry"] = week_info.get('TrackCountry', '')
                data["trackLength"] = week_info.get('TrackLength', '')
                options = week_info.get('WeekendOptions', {}) if isinstance(week_info.get('WeekendOptions'), dict) else {}
                data["skies"] = str(ir.get('Skies', '') or options.get('Skies', '') or '')
                data["windSpeed"] = round(float(ir.get('WindVel', 0) or 0) * 3.6, 1)
                data["windDir"] = round(float(ir.get('WindDir', 0) or 0) * 57.3, 0)
                data["humidity"] = round(float(ir.get('RelativeHumidity', 0) or 0), 0)
                data["trackState"] = str(ir.get('TrackWetness', '') or 'dry')
        except Exception:
            pass

        # Driver info
        try:
            driver_info = ir['DriverInfo']
            if driver_info:
                drivers = driver_info.get('Drivers', [])
                driver_idx = int(ir['PlayerCarIdx'] or 0)
                if drivers and driver_idx < len(drivers):
                    my_driver = drivers[driver_idx]
                    data["driverName"] = my_driver.get('UserName', '')
                    data["driverID"] = my_driver.get('UserID', 0)
                    data["driverIRating"] = my_driver.get('IRating', 0)
                    data["driverLicense"] = my_driver.get('LicString', '')
                    data["carName"] = my_driver.get('CarScreenName', '') or my_driver.get('CarPath', '')
                    data["carNumber"] = my_driver.get('CarNumber', '')
                    data["carClass"] = my_driver.get('CarClassShortName', '')
        except Exception:
            pass

        # Session name
        try:
            session_info = ir['SessionInfo']
            if session_info:
                sessions = session_info.get('Sessions', [])
                sn = int(ir['SessionNum'] or 0)
                if sessions and sn < len(sessions):
                    data["sessionName"] = sessions[sn].get('SessionName', '')
        except Exception:
            pass

        # Handling / Understeer-Oversteer
        try:
            vel_x = float(ir['VelocityX'] or 0)
            vel_y = float(ir['VelocityY'] or 0)
            yaw_rate = float(ir['YawRate'] or 0)
            steer = float(ir['SteeringWheelAngle'] or 0)
            speed_ms = float(ir['Speed'] or 0)
            if speed_ms > 5:
                steer_deg = steer * 57.3
                actual_yaw = yaw_rate * 57.3
                understeer_value = steer_deg - (actual_yaw * 2.5)
                data["understeerIndicator"] = round(understeer_value, 2)
                if understeer_value > 5:
                    data["handling"] = "understeer"
                elif understeer_value < -5:
                    data["handling"] = "oversteer"
                else:
                    data["handling"] = "neutral"
            else:
                data["handling"] = "neutral"
                data["understeerIndicator"] = 0
        except Exception:
            data["handling"] = "neutral"
            data["understeerIndicator"] = 0

        # ABS
        try:
            data["absActive"] = bool(ir['BrakeABSactive'])
        except Exception:
            data["absActive"] = False

        # Tire temps
        try:
            data["tireLF_inner"] = round(float(ir['LFtempCL'] or 0), 1)
            data["tireLF_mid"] = round(float(ir['LFtempCM'] or 0), 1)
            data["tireLF_outer"] = round(float(ir['LFtempCR'] or 0), 1)
            data["tireRF_inner"] = round(float(ir['RFtempCL'] or 0), 1)
            data["tireRF_mid"] = round(float(ir['RFtempCM'] or 0), 1)
            data["tireRF_outer"] = round(float(ir['RFtempCR'] or 0), 1)
            data["tireLR_inner"] = round(float(ir['LRtempCL'] or 0), 1)
            data["tireLR_mid"] = round(float(ir['LRtempCM'] or 0), 1)
            data["tireLR_outer"] = round(float(ir['LRtempCR'] or 0), 1)
            data["tireRR_inner"] = round(float(ir['RRtempCL'] or 0), 1)
            data["tireRR_mid"] = round(float(ir['RRtempCM'] or 0), 1)
            data["tireRR_outer"] = round(float(ir['RRtempCR'] or 0), 1)
            data["tireLF_temp"] = round((data["tireLF_inner"] + data["tireLF_mid"] + data["tireLF_outer"]) / 3, 1)
            data["tireRF_temp"] = round((data["tireRF_inner"] + data["tireRF_mid"] + data["tireRF_outer"]) / 3, 1)
            data["tireLR_temp"] = round((data["tireLR_inner"] + data["tireLR_mid"] + data["tireLR_outer"]) / 3, 1)
            data["tireRR_temp"] = round((data["tireRR_inner"] + data["tireRR_mid"] + data["tireRR_outer"]) / 3, 1)
        except Exception:
            data["tireLF_temp"] = 0
            data["tireRF_temp"] = 0
            data["tireLR_temp"] = 0
            data["tireRR_temp"] = 0

        # Tire wear
        try:
            data["tireLF_wear"] = round((1 - float(ir['LFwearM'] or 1)) * 100, 1)
            data["tireRF_wear"] = round((1 - float(ir['RFwearM'] or 1)) * 100, 1)
            data["tireLR_wear"] = round((1 - float(ir['LRwearM'] or 1)) * 100, 1)
            data["tireRR_wear"] = round((1 - float(ir['RRwearM'] or 1)) * 100, 1)
        except Exception:
            pass

        # Engine / Fluids
        try:
            data["oilTemp"] = round(float(ir['OilTemp'] or 0), 1)
            data["oilPress"] = round(float(ir['OilPress'] or 0), 1)
            data["waterTemp"] = round(float(ir['WaterTemp'] or 0), 1)
            data["voltage"] = round(float(ir['Voltage'] or 0), 1)
        except Exception:
            pass

        # Tire compound
        try:
            data["tireCompound"] = str(ir.get('PlayerTireCompound', '') or 'Unknown')
        except Exception:
            data["tireCompound"] = "Unknown"

        # Track surface / off-track
        try:
            track_surface = int(ir.get('PlayerTrackSurface', 3) or 3)
            on_track = bool(ir['IsOnTrack'] or False)
            on_pit = bool(ir['OnPitRoad'] or False)
            data["isOffTrack"] = track_surface == 0 and on_track and not on_pit
            data["trackSurface"] = track_surface
        except Exception:
            data["isOffTrack"] = False
            data["trackSurface"] = 3

        # Deltas
        try:
            data["deltaToOptimal"] = round(float(ir.get('LapDeltaToOptimalLap', 0) or 0), 3)
            data["deltaToBestLap"] = round(float(ir.get('LapDeltaToBestLap', 0) or 0), 3)
        except Exception:
            pass

        # Flags
        try:
            flags = ir['SessionFlags'] or 0
            data["flags"] = []
            if flags & 0x0004: data["flags"].append("green")
            if flags & 0x0010: data["flags"].append("yellow")
            if flags & 0x0020: data["flags"].append("red")
            if flags & 0x0080: data["flags"].append("blue")
            if flags & 0x0100: data["flags"].append("white")
            if flags & 0x0200: data["flags"].append("checkered")
        except Exception:
            data["flags"] = []

        # Ride height / suspension (extra telemetry for analysis)
        try:
            data["rideHeightLF"] = round(float(ir.get('LFrideHeight', 0) or 0) * 1000, 1)  # mm
            data["rideHeightRF"] = round(float(ir.get('RFrideHeight', 0) or 0) * 1000, 1)
            data["rideHeightLR"] = round(float(ir.get('LRrideHeight', 0) or 0) * 1000, 1)
            data["rideHeightRR"] = round(float(ir.get('RRrideHeight', 0) or 0) * 1000, 1)
        except Exception:
            pass

        return data

    except Exception as e:
        print(f"[WARN] Error leyendo: {e}")
        return {"connected": ir_connected, "error": str(e), "timestamp": time.time()}


# ============================================================
# WEBSOCKET
# ============================================================
async def handler(ws):
    clients.add(ws)
    ip = ws.remote_address[0] if ws.remote_address else "?"
    print(f"[+] Cliente: {ip} (total: {len(clients)})")
    try:
        await ws.wait_closed()
    except Exception:
        pass
    finally:
        clients.discard(ws)
        print(f"[-] Cliente: {ip} (total: {len(clients)})")


# ============================================================
# MAIN BROADCAST + LOGGING LOOP
# ============================================================
async def broadcast():
    global current_lap_num, current_lap_data, session_dir

    print(f"[...] Loop iniciado ({SAMPLE_RATE_HZ} Hz) — broadcast + logging")
    off_track_cooldown = 0

    while True:
        try:
            data = safe_read()
            if not data:
                await asyncio.sleep(1.0 / SAMPLE_RATE_HZ)
                continue

            # --- Initialize session logging on first valid data ---
            if data.get('isOnTrack') and session_dir is None:
                track = data.get('trackName', 'unknown')
                driver = data.get('driverName', 'unknown')
                init_session_logging(track, driver)

            # --- Save session info once ---
            if session_dir and data.get('driverName'):
                save_session_info(data)

            # --- Lap tracking ---
            lap = data.get('lap', 0)
            if lap > 0 and lap != current_lap_num:
                # Lap changed — save previous lap summary
                if current_lap_num > 0 and current_lap_data:
                    save_lap_summary(current_lap_num, current_lap_data)
                current_lap_num = lap
                current_lap_data = []

            # Accumulate lap data
            if data.get('isOnTrack'):
                current_lap_data.append(data)

            # --- Event detection ---
            now = time.time()
            if data.get('isOffTrack') and now > off_track_cooldown:
                pct = data.get('lapDistPct', 0)
                log_event("off_track", {"lap": lap, "trackPct": pct, "speed": data.get('speed', 0)},
                          f"Off track @ {pct:.0f}% lap {lap}")
                off_track_cooldown = now + 3  # 3s cooldown

            # --- Log telemetry to disk ---
            log_sample(data)

            # --- Broadcast to WS clients ---
            if clients:
                msg = json.dumps(data)
                current_clients = clients.copy()
                dead = set()
                for c in current_clients:
                    try:
                        await c.send(msg)
                    except Exception:
                        dead.add(c)
                if dead:
                    clients.difference_update(dead)

        except Exception as e:
            print(f"[ERR] Loop error: {e}")
            traceback.print_exc()

        await asyncio.sleep(1.0 / SAMPLE_RATE_HZ)


# ============================================================
# HTTP API — Serve recorded sessions (for Analysis page)
# ============================================================
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading
import urllib.parse

SESSIONS_DIR = Path("./sessions")


class SessionsAPIHandler(BaseHTTPRequestHandler):
    """Simple HTTP handler for the Analysis frontend to fetch session data."""

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # CORS headers
        self.send_cors_headers = lambda: None  # defined below

        if path == '/api/sessions':
            self.handle_list_sessions()
        elif path.startswith('/api/sessions/'):
            self.handle_get_session_file(path)
        else:
            self.send_error(404)

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors()
        self.end_headers()

    def _send_cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def handle_list_sessions(self):
        """Returns list of session folders with metadata."""
        sessions = []
        if SESSIONS_DIR.exists():
            for folder in sorted(SESSIONS_DIR.iterdir(), reverse=True):
                if folder.is_dir():
                    info_file = folder / "session_info.json"
                    info = {}
                    if info_file.exists():
                        try:
                            info = json.loads(info_file.read_text(encoding='utf-8'))
                        except Exception:
                            pass
                    sessions.append({
                        "name": folder.name,
                        "driver": info.get("driver", ""),
                        "car": info.get("car", ""),
                        "track": info.get("track", ""),
                        "date": info.get("startTime", ""),
                        "sessionName": info.get("sessionName", ""),
                    })

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self._send_cors()
        self.end_headers()
        self.wfile.write(json.dumps(sessions).encode())

    def handle_get_session_file(self, path: str):
        """Returns a specific file from a session folder."""
        # Path: /api/sessions/<session_name>/<filename>
        parts = path.replace('/api/sessions/', '').split('/')
        if len(parts) != 2:
            self.send_error(400)
            return

        session_name, filename = parts[0], parts[1]
        # Security: prevent path traversal
        if '..' in session_name or '..' in filename or '/' in session_name:
            self.send_error(403)
            return

        file_path = SESSIONS_DIR / session_name / filename
        if not file_path.exists() or not file_path.is_file():
            self.send_error(404)
            return

        content = file_path.read_text(encoding='utf-8')
        content_type = 'application/json' if filename.endswith('.json') else 'text/plain'

        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self._send_cors()
        self.end_headers()
        self.wfile.write(content.encode())

    def log_message(self, format, *args):
        # Suppress default HTTP logging noise
        pass


def start_http_server():
    """Start HTTP API server in a background thread."""
    server = HTTPServer(('0.0.0.0', HTTP_PORT), SessionsAPIHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


# ============================================================
# ENTRY POINT
# ============================================================
async def main():
    ip = get_ip()

    # Start HTTP API for session data
    start_http_server()

    print("=" * 55)
    print("  ApexVision AI — iRacing Telemetry Server v3")
    print("  (Unified: Live + Recording + Sessions API)")
    print("=" * 55)
    print(f"  WebSocket:  ws://{ip}:{WS_PORT}")
    print(f"  Sessions:   http://{ip}:{HTTP_PORT}/api/sessions")
    print(f"  Dashboard:  http://localhost:5173/live")
    print(f"  Analysis:   http://localhost:5173/analysis")
    print(f"  Rate:       {SAMPLE_RATE_HZ} Hz")
    print(f"  Recording:  ./sessions/")
    print(f"  Esperando iRacing...")
    print("=" * 55)

    try:
        async with serve(handler, "0.0.0.0", WS_PORT):
            await broadcast()
    finally:
        # Save last lap on exit
        if current_lap_num > 0 and current_lap_data:
            save_lap_summary(current_lap_num, current_lap_data)
        close_session_logging()
        print("\n[FIN] Sesión guardada.")


if __name__ == "__main__":
    asyncio.run(main())
