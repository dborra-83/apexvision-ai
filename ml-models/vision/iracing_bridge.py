"""
ApexVision AI — iRacing Live Telemetry Bridge

Lee telemetría en tiempo real desde iRacing vía shared memory (SDK)
y la expone vía WebSocket server para que el dashboard se conecte.

INSTALACIÓN (en tu PC de iRacing):
    pip install pyirsdk websockets

USO:
    1. Abrir iRacing y entrar a una sesión (práctica, carrera, etc.)
    2. Ejecutar: python iracing_bridge.py
    3. Abrir el dashboard en http://TU_IP:8080 o en CloudFront
    4. El dashboard se conecta a ws://TU_IP:8765

El server acepta conexiones de cualquier dispositivo en tu red local.
"""

import asyncio
import json
import time
from typing import Set

import irsdk
import websockets
from websockets.server import WebSocketServerProtocol

# Configuración
WS_HOST = "0.0.0.0"  # Escuchar en todas las interfaces (accesible desde red local)
WS_PORT = 8765
UPDATE_RATE_HZ = 30  # 30 updates por segundo

# Estado global
connected_clients: Set[WebSocketServerProtocol] = set()
ir = irsdk.IRSDK()
is_connected = False


def connect_iracing() -> bool:
    """Intenta conectar a iRacing."""
    global is_connected
    if ir.startup():
        is_connected = True
        print("✅ Conectado a iRacing")
        return True
    return False


def get_telemetry() -> dict:
    """Lee la telemetría actual de iRacing."""
    if not is_connected:
        return {}

    try:
        ir.freeze_var_buffer_latest()

        # Datos del vehículo
        speed_ms = ir['Speed'] or 0
        speed_kmh = speed_ms * 3.6

        rpm = ir['RPM'] or 0
        gear = ir['Gear'] or 0  # -1=R, 0=N, 1-8=forward
        throttle = (ir['Throttle'] or 0) * 100  # 0-1 → 0-100%
        brake = (ir['Brake'] or 0) * 100
        clutch = (ir['Clutch'] or 0) * 100
        steering = ir['SteeringWheelAngle'] or 0  # radianes
        steering_deg = steering * (180 / 3.14159)

        # Posición en pista
        lap = ir['Lap'] or 0
        lap_dist_pct = ir['LapDistPct'] or 0
        lap_best_time = ir['LapBestLapTime'] or 0
        lap_last_time = ir['LapLastLapTime'] or 0
        lap_current_time = ir['LapCurrentLapTime'] or 0

        # Posición en carrera
        position = ir['PlayerCarPosition'] or 0
        class_position = ir['PlayerCarClassPosition'] or 0

        # Neumáticos (temperaturas promedio)
        tire_lf_temp = ir['LFtempCL'] or 0  # Center Left Front
        tire_rf_temp = ir['RFtempCL'] or 0
        tire_lr_temp = ir['LRtempCL'] or 0
        tire_rr_temp = ir['RRtempCL'] or 0

        # Tire wear (si disponible)
        tire_lf_wear = (ir['LFwearL'] or 0 + ir['LFwearM'] or 0 + ir['LFwearR'] or 0) / 3.0 * 100
        tire_rf_wear = (ir['RFwearL'] or 0 + ir['RFwearM'] or 0 + ir['RFwearR'] or 0) / 3.0 * 100
        tire_lr_wear = (ir['LRwearL'] or 0 + ir['LRwearM'] or 0 + ir['LRwearR'] or 0) / 3.0 * 100
        tire_rr_wear = (ir['RRwearL'] or 0 + ir['RRwearM'] or 0 + ir['RRwearR'] or 0) / 3.0 * 100

        # Combustible
        fuel_level = ir['FuelLevel'] or 0
        fuel_pct = ir['FuelLevelPct'] or 0

        # G-forces
        lat_accel = ir['LatAccel'] or 0  # m/s^2
        long_accel = ir['LongAccel'] or 0
        lat_g = lat_accel / 9.81
        long_g = long_accel / 9.81

        # Sesión
        session_time = ir['SessionTime'] or 0
        session_laps_remain = ir['SessionLapsRemainEx'] or 0

        # Flags
        is_on_track = ir['IsOnTrack'] or False
        engine_warnings = ir['EngineWarnings'] or 0

        # DRS / Push to Pass (si disponible)
        drs_status = ir['DRS_Status'] or 0

        # Info del piloto y coche
        driver_name = ""
        car_name = ""
        track_name = ""
        try:
            driver_idx = ir['PlayerCarIdx'] or 0
            if ir['DriverInfo']:
                drivers = ir['DriverInfo']['Drivers']
                if driver_idx < len(drivers):
                    driver_name = drivers[driver_idx]['UserName']
                    car_name = drivers[driver_idx]['CarScreenName']
            if ir['WeekendInfo']:
                track_name = ir['WeekendInfo']['TrackName']
        except (KeyError, TypeError, IndexError):
            pass

        return {
            "timestamp": time.time(),
            "connected": True,
            "isOnTrack": bool(is_on_track),

            # Core telemetry
            "speed": round(speed_kmh, 1),
            "rpm": round(rpm),
            "gear": gear,
            "throttle": round(throttle, 1),
            "brake": round(brake, 1),
            "clutch": round(clutch, 1),
            "steering": round(steering_deg, 1),

            # Lap info
            "lap": lap,
            "lapDistPct": round(lap_dist_pct * 100, 1),
            "lapBestTime": round(lap_best_time, 3) if lap_best_time > 0 else None,
            "lapLastTime": round(lap_last_time, 3) if lap_last_time > 0 else None,
            "lapCurrentTime": round(lap_current_time, 3),

            # Position
            "position": position,
            "classPosition": class_position,

            # Tires
            "tires": {
                "lf": {"temp": round(tire_lf_temp, 1), "wear": round(tire_lf_wear, 1)},
                "rf": {"temp": round(tire_rf_temp, 1), "wear": round(tire_rf_wear, 1)},
                "lr": {"temp": round(tire_lr_temp, 1), "wear": round(tire_lr_wear, 1)},
                "rr": {"temp": round(tire_rr_temp, 1), "wear": round(tire_rr_wear, 1)},
            },

            # Fuel
            "fuelLevel": round(fuel_level, 2),
            "fuelPct": round(fuel_pct * 100, 1),

            # G-forces
            "gLateral": round(lat_g, 2),
            "gLongitudinal": round(long_g, 2),

            # Session
            "sessionTime": round(session_time, 1),
            "lapsRemaining": session_laps_remain,
            "drs": drs_status > 0,

            # Info
            "driverName": driver_name,
            "carName": car_name,
            "trackName": track_name,
        }

    except Exception as e:
        print(f"⚠️  Error leyendo telemetría: {e}")
        return {"connected": False, "error": str(e), "timestamp": time.time()}


async def broadcast(message: str):
    """Envía un mensaje a todos los clientes conectados."""
    if connected_clients:
        await asyncio.gather(
            *[client.send(message) for client in connected_clients],
            return_exceptions=True
        )


async def handler(websocket: WebSocketServerProtocol):
    """Maneja una nueva conexión WebSocket."""
    connected_clients.add(websocket)
    remote = websocket.remote_address
    print(f"📱 Cliente conectado: {remote[0]}:{remote[1]} ({len(connected_clients)} total)")

    try:
        # Enviar info inicial
        await websocket.send(json.dumps({
            "type": "welcome",
            "message": "ApexVision AI - iRacing Bridge",
            "updateRate": UPDATE_RATE_HZ,
            "iracingConnected": is_connected,
        }))

        # Mantener conexión abierta
        async for message in websocket:
            # Procesar comandos del cliente si los hay
            try:
                cmd = json.loads(message)
                if cmd.get("action") == "ping":
                    await websocket.send(json.dumps({"type": "pong", "timestamp": time.time()}))
            except json.JSONDecodeError:
                pass

    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        connected_clients.discard(websocket)
        print(f"📱 Cliente desconectado: {remote[0]}:{remote[1]} ({len(connected_clients)} total)")


async def telemetry_loop():
    """Loop principal que lee telemetría y la envía a los clientes."""
    global is_connected
    interval = 1.0 / UPDATE_RATE_HZ
    reconnect_interval = 5.0
    last_reconnect = 0

    print(f"🔄 Telemetry loop iniciado ({UPDATE_RATE_HZ} Hz)")

    while True:
        now = time.time()

        # Intentar conectar/reconectar a iRacing
        if not is_connected:
            if now - last_reconnect > reconnect_interval:
                last_reconnect = now
                if connect_iracing():
                    print("🏎️  iRacing detectado — transmitiendo telemetría")
                else:
                    # Enviar estado desconectado
                    await broadcast(json.dumps({
                        "type": "telemetry",
                        "data": {"connected": False, "timestamp": now, "waiting": True}
                    }))
            await asyncio.sleep(reconnect_interval)
            continue

        # Verificar que sigue conectado
        if not ir.is_connected:
            is_connected = False
            print("⚠️  iRacing desconectado — esperando reconexión...")
            continue

        # Leer y transmitir telemetría
        telemetry = get_telemetry()
        if telemetry:
            message = json.dumps({"type": "telemetry", "data": telemetry})
            await broadcast(message)

        await asyncio.sleep(interval)


async def main():
    """Punto de entrada principal."""
    print("=" * 60)
    print("  🏎️  ApexVision AI — iRacing Live Telemetry Bridge")
    print("=" * 60)
    print(f"  WebSocket Server: ws://{WS_HOST}:{WS_PORT}")
    print(f"  Update Rate: {UPDATE_RATE_HZ} Hz")
    print(f"  Dashboard: Conectar a ws://TU_IP:{WS_PORT}")
    print("=" * 60)
    print()
    print("  Esperando conexión a iRacing...")
    print("  (Abrí iRacing y entrá a una sesión)")
    print()

    # Iniciar WebSocket server
    server = await websockets.serve(handler, WS_HOST, WS_PORT)
    print(f"✅ WebSocket server corriendo en ws://0.0.0.0:{WS_PORT}")

    # Iniciar loop de telemetría
    await telemetry_loop()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n⏹  Bridge detenido")
