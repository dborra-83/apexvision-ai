# iRacing Live Telemetry — Setup Guide

## Qué hace

Lee telemetría en tiempo real de iRacing vía shared memory y la envía por WebSocket a cualquier dispositivo en tu red local.

## Datos que captura

| Categoría | Datos |
|-----------|-------|
| **Core** | Speed, RPM, Gear, Throttle%, Brake%, Clutch%, Steering angle |
| **Lap** | Lap number, lap distance %, best/last/current lap time |
| **Position** | Overall position, class position |
| **Tires** | Temperatura y desgaste por neumático (LF, RF, LR, RR) |
| **Fuel** | Nivel, porcentaje |
| **G-Forces** | Lateral G, Longitudinal G |
| **Session** | Session time, laps remaining, DRS status |
| **Info** | Driver name, car name, track name |

## Instalación (en tu PC de iRacing)

```bash
# 1. Instalar Python 3.10+ (si no lo tenés)
# Descargar de https://python.org

# 2. Instalar dependencias
pip install pyirsdk websockets

# 3. Ejecutar el bridge
python iracing_bridge.py
```

## Uso

1. **Abrí iRacing** y entrá a cualquier sesión (practice, race, etc.)
2. **Ejecutá el bridge** en una terminal:
   ```
   python iracing_bridge.py
   ```
3. **Abrí el dashboard** en cualquier browser de tu red:
   - Si es la misma PC: `http://localhost:8080`
   - Desde otro dispositivo: `http://192.168.x.x:8080` (tu IP local)

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
