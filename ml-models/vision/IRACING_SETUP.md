# iRacing Live Telemetry — Setup Guide

## Qué hace

Lee telemetría en tiempo real de iRacing vía shared memory y la envía por WebSocket a cualquier dispositivo en tu red local. Graba cada sesión automáticamente en disco y la sube a S3 (opcional).

## Datos que captura

| Categoría | Datos |
|-----------|-------|
| **Core** | Speed, RPM, Gear, Throttle%, Brake%, Clutch%, Steering angle |
| **Lap** | Lap number, lap distance %, best/last/current lap time, delta to best/optimal |
| **Position** | Overall position, class position |
| **Tires** | Temperatura (inner/mid/outer) y desgaste por neumático (LF, RF, LR, RR) |
| **Fuel** | Nivel en litros, porcentaje, consumo L/h |
| **G-Forces** | Lateral G, Longitudinal G |
| **Handling** | Understeer/Oversteer indicator, ABS activo, yaw rate |
| **Engine** | Oil temp/press, water temp, voltage, manifold pressure |
| **Weather** | Air temp, track temp, wind speed/dir, humidity, skies |
| **Shift Lights** | slFirstRPM, slShiftRPM, slBlinkRPM (específico del auto) |
| **DRS** | Estado DRS (0=off, 1=available, 2=active) |
| **Setup** | Brake bias, traction control setting |
| **Pit/Damage** | Pit repair time, optimal repair time, pitstop active |
| **Flags** | Green, yellow, red, blue, white, checkered |
| **Session** | Laps remaining, session time, total laps, race laps |
| **Info** | Driver name/iRating/license, car name/number/class, track name/config |

## Instalación (en tu PC de iRacing — Windows)

> ⚠️ `iracing_live.py` usa Windows Shared Memory y debe correr en Windows, no en WSL.

```bash
# 1. Instalar Python 3.10+ desde https://python.org
#    (marcar "Add to PATH" en el installer)

# 2. Instalar dependencias
pip install pyirsdk websockets

# Opcional — para grabar sesiones en S3:
pip install boto3
```

## Uso

1. **Abrí iRacing** y entrá a cualquier sesión (practice, qualifying, race)
2. **Ejecutá el servidor** en una terminal de Windows (CMD o PowerShell):
   ```
   python iracing_live.py
   ```
3. **Abrí el dashboard** en cualquier browser de tu red:
   - Misma PC: `http://localhost:3000/live`
   - Otro dispositivo (tablet, segundo monitor): `http://TU_IP:3000/live`

## Conectar el Dashboard

En el dashboard de ApexVision AI, cambiá el WebSocket endpoint a:
```
ws://TU_IP_LOCAL:8765
```

O si corrés todo en la misma PC:
```
ws://localhost:8765
```

## Datos en tiempo real

El bridge envía 30 updates por segundo con toda la telemetría disponible en formato JSON:

```json
{
  "type": "telemetry",
  "data": {
    "speed": 287.3,
    "rpm": 7200,
    "gear": 5,
    "throttle": 92.5,
    "brake": 0,
    "steering": -12.3,
    "lap": 15,
    "position": 2,
    "tires": {
      "lf": {"temp": 95.2, "wear": 23.1},
      "rf": {"temp": 97.8, "wear": 25.4},
      "lr": {"temp": 89.1, "wear": 18.7},
      "rr": {"temp": 91.3, "wear": 20.2}
    },
    "fuelPct": 67.3,
    "gLateral": 1.23,
    "gLongitudinal": -0.45,
    "driverName": "Diego Borra",
    "trackName": "Mount Panorama Circuit"
  }
}
```

## Troubleshooting

- **"Esperando conexión a iRacing..."** — iRacing no está abierto o no estás en una sesión activa
- **El dashboard no conecta** — Verificá que el firewall permite conexiones en puerto 8765
- **Datos a 0** — Asegurate de estar en pista (no en garage)

## Para grabar sesiones

Los datos también se pueden guardar a un archivo JSON para análisis posterior:
```bash
python iracing_bridge.py --record session_output.json
```
