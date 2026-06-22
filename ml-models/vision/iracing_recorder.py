"""
ApexVision AI — iRacing Session Recorder

Graba telemetría de cada vuelta en DynamoDB para análisis posterior con Bedrock AI.
Corre junto a iracing_live.py en la misma PC.

Uso:
  py iracing_recorder.py

Requiere:
  pip install pyirsdk boto3

Estructura en DynamoDB (tabla: apexvision-dev-metrics-realtime):
  PK: SESSION#{session_id}
  SK: LAP#{lap_number}#{timestamp}
  Data: todas las métricas de esa muestra
"""

import json
import time
import uuid
from datetime import datetime

try:
    import irsdk
except ImportError:
    print("pip install pyirsdk")
    exit(1)

try:
    import boto3
except ImportError:
    print("pip install boto3")
    exit(1)

# Config
TABLE_NAME = "apexvision-dev-metrics-realtime"
REGION = "us-east-1"
SAMPLE_RATE_HZ = 2  # Save 2 samples per second (less than live for cost)

# AWS
dynamodb = boto3.resource('dynamodb', region_name=REGION)
table = dynamodb.Table(TABLE_NAME)

# iRacing
ir = irsdk.IRSDK()


def generate_session_id():
    """Generate unique session ID."""
    return f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"


def read_telemetry():
    """Read current telemetry from iRacing."""
    try:
        speed = ir['Speed']
        if speed is None:
            return None

        return {
            "speed": round(float(speed) * 3.6, 1),
            "rpm": round(float(ir['RPM'] or 0)),
            "gear": int(ir['Gear'] or 0),
            "throttle": round(float(ir['Throttle'] or 0) * 100),
            "brake": round(float(ir['Brake'] or 0) * 100),
            "steering": round(float(ir['SteeringWheelAngle'] or 0) * 57.3, 1),
            "lap": int(ir['Lap'] or 0),
            "lapDistPct": round(float(ir['LapDistPct'] or 0) * 100, 1),
            "position": int(ir['PlayerCarPosition'] or 0),
            "lastLapTime": round(float(ir['LapLastLapTime'] or 0), 3),
            "bestLapTime": round(float(ir['LapBestLapTime'] or 0), 3),
            "currentLapTime": round(float(ir['LapCurrentLapTime'] or 0), 3),
            "fuelPercent": round(float(ir['FuelLevelPct'] or 0) * 100, 1),
            "gLateral": round(float(ir['LatAccel'] or 0), 2),
            "gLongitudinal": round(float(ir['LongAccel'] or 0), 2),
            "trackTemp": round(float(ir['TrackTempCrew'] or 0), 1),
            "isOnTrack": bool(ir['IsOnTrack'] or False),
        }
    except Exception as e:
        print(f"[WARN] Read error: {e}")
        return None


def save_to_dynamo(session_id: str, data: dict):
    """Save a telemetry sample to DynamoDB."""
    try:
        item = {
            "PK": f"SESSION#{session_id}",
            "SK": f"LAP#{data['lap']:04d}#{int(time.time() * 1000)}",
            "sessionId": session_id,
            "timestamp": int(time.time() * 1000),
            "timestampCaptura": int(time.time() * 1000),
            **{k: str(v) if isinstance(v, bool) else v for k, v in data.items()},
            "ttl": int(time.time()) + 86400 * 30,  # 30 days TTL
        }
        # Convert floats to Decimal for DynamoDB
        from decimal import Decimal
        def convert(obj):
            if isinstance(obj, float):
                return Decimal(str(obj))
            return obj

        clean_item = {k: convert(v) for k, v in item.items()}
        table.put_item(Item=clean_item)
        return True
    except Exception as e:
        print(f"[ERR] DynamoDB write failed: {e}")
        return False


def save_lap_summary(session_id: str, lap: int, lap_time: float, data: dict):
    """Save a lap summary for Bedrock analysis."""
    try:
        from decimal import Decimal
        item = {
            "PK": f"SESSION#{session_id}",
            "SK": f"LAPSUMMARY#{lap:04d}",
            "sessionId": session_id,
            "lapNumber": lap,
            "lapTime": Decimal(str(lap_time)),
            "timestamp": int(time.time() * 1000),
            "avgSpeed": Decimal(str(data.get('speed', 0))),
            "position": data.get('position', 0),
            "fuelUsed": Decimal(str(data.get('fuelPercent', 0))),
            "ttl": int(time.time()) + 86400 * 365,  # 1 year for summaries
        }
        table.put_item(Item=item)
        print(f"  [DB] Lap {lap} saved: {fmt_time(lap_time)}")
        return True
    except Exception as e:
        print(f"[ERR] Lap summary write failed: {e}")
        return False


def fmt_time(t):
    return f"{int(t // 60)}:{(t % 60):.3f}" if t > 0 else "--:--.---"


def main():
    session_id = generate_session_id()
    print("=" * 50)
    print("  ApexVision AI — Session Recorder")
    print("=" * 50)
    print(f"  Session: {session_id}")
    print(f"  Table: {TABLE_NAME}")
    print(f"  Rate: {SAMPLE_RATE_HZ} Hz")
    print(f"  Waiting for iRacing...")
    print("=" * 50)

    prev_lap = 0
    samples_saved = 0
    interval = 1.0 / SAMPLE_RATE_HZ

    while True:
        if not ir.is_connected:
            if not ir.startup():
                time.sleep(2)
                continue
            print("[OK] Connected to iRacing")

        data = read_telemetry()
        if data is None:
            time.sleep(0.5)
            continue

        # Only record when on track
        if not data.get('isOnTrack'):
            time.sleep(0.5)
            continue

        # Save telemetry sample
        if save_to_dynamo(session_id, data):
            samples_saved += 1
            if samples_saved % 20 == 0:
                print(f"  [{samples_saved} samples] Lap {data['lap']} · {data['speed']} km/h · P{data['position']}")

        # Detect new lap
        if data['lap'] > prev_lap and data['lastLapTime'] > 0:
            save_lap_summary(session_id, prev_lap, data['lastLapTime'], data)
            prev_lap = data['lap']

        time.sleep(interval)


if __name__ == "__main__":
    main()
