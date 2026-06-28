"""
Assetto Corsa Competizione Connector — reads telemetry via Windows Shared Memory.
ACC uses different struct layouts than AC1.
"""
import time
import struct
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from .base import BaseConnector
from schema.field_availability import FIELD_AVAILABILITY

try:
    import mmap
except ImportError:
    mmap = None


class ACCConnector(BaseConnector):

    def __init__(self):
        self._physics_mmap = None
        self._graphics_mmap = None
        self._static_mmap = None
        self._connected = False
        self._last_packet_id = -1
        self._last_update_time = 0
        self._static_info: dict = {}

    @property
    def simulator_name(self) -> str:
        return 'acc'

    @property
    def field_availability(self) -> dict[str, bool]:
        return FIELD_AVAILABILITY['acc']

    def connect(self) -> None:
        try:
            # ACC uses larger shared memory regions than AC1
            self._physics_mmap = mmap.mmap(-1, 1024, "Local\\acpmf_physics", access=mmap.ACCESS_READ)
            self._graphics_mmap = mmap.mmap(-1, 2048, "Local\\acpmf_graphics", access=mmap.ACCESS_READ)
            self._static_mmap = mmap.mmap(-1, 1024, "Local\\acpmf_static", access=mmap.ACCESS_READ)
            self._connected = True
            self._read_static()
            print("[ACC] Connected to ACC shared memory")
        except Exception as e:
            raise ConnectionError(f"ACC is not running or shared memory not available: {e}")

    def disconnect(self) -> None:
        for mm in [self._physics_mmap, self._graphics_mmap, self._static_mmap]:
            if mm:
                try:
                    mm.close()
                except Exception:
                    pass
        self._physics_mmap = None
        self._graphics_mmap = None
        self._static_mmap = None
        self._connected = False

    def is_connected(self) -> bool:
        if time.time() - self._last_update_time > 2.0:
            self._connected = False
        return self._connected

    def _read_static(self):
        """Read one-time info (car, track, driver)."""
        if not self._static_mmap:
            return
        self._static_mmap.seek(0)
        raw = self._static_mmap.read(800)
        try:
            # ACC static struct offsets (different from AC1)
            # smVersion at 0 (15 wchars = 30 bytes)
            # acVersion at 30 (15 wchars)
            # numberOfSessions at 60 (int)
            # numCars at 64 (int)
            # carModel at 68 (33 wchars = 66 bytes)
            # track at 134 (33 wchars)
            # playerName at 200 (33 wchars)
            car = raw[68:134].decode('utf-16-le', errors='ignore').rstrip('\x00')
            track = raw[134:200].decode('utf-16-le', errors='ignore').rstrip('\x00')
            player = raw[200:266].decode('utf-16-le', errors='ignore').rstrip('\x00')
            self._static_info = {'carName': car, 'trackName': track, 'driverName': player}
        except Exception:
            self._static_info = {}

    def _read_physics(self) -> dict:
        """Read real-time physics data (ACC-specific layout)."""
        if not self._physics_mmap:
            return {}
        self._physics_mmap.seek(0)
        raw = self._physics_mmap.read(500)

        try:
            # ACC Physics struct (key fields)
            packet_id = struct.unpack_from('<i', raw, 0)[0]
            gas = struct.unpack_from('<f', raw, 4)[0]
            brake_val = struct.unpack_from('<f', raw, 8)[0]
            fuel = struct.unpack_from('<f', raw, 12)[0]
            gear = struct.unpack_from('<i', raw, 16)[0]  # 0=R, 1=N, 2=1st...
            rpm = struct.unpack_from('<i', raw, 20)[0]
            steer = struct.unpack_from('<f', raw, 24)[0]
            speed = struct.unpack_from('<f', raw, 28)[0]  # km/h

            # G-forces (ACC: offset 68)
            g_x = struct.unpack_from('<f', raw, 68)[0]
            g_z = struct.unpack_from('<f', raw, 76)[0]

            # Tire temps (surface, 4 floats at offset 104)
            tire_temps = struct.unpack_from('<4f', raw, 104)

            # Brake temps (4 floats at offset 136)
            # Tire wear (4 floats at offset 152)
            tire_wear = struct.unpack_from('<4f', raw, 152)

            # Water temp at offset 200, Oil temp never directly available in ACC shared mem
            water_temp = struct.unpack_from('<f', raw, 200)[0] if len(raw) > 204 else 0
            oil_press = struct.unpack_from('<f', raw, 204)[0] if len(raw) > 208 else 0

            # ABS (at offset 236)
            abs_active = struct.unpack_from('<f', raw, 236)[0] > 0 if len(raw) > 240 else False

            # Track surface grip (offset 256)
            # Rain intensity at offset 260

            if packet_id != self._last_packet_id:
                self._last_packet_id = packet_id
                self._last_update_time = time.time()

            std_gear = gear - 1 if gear >= 1 else -1

            return {
                'speed': round(speed, 1),
                'rpm': int(rpm),
                'gear': std_gear,
                'throttle': round(gas * 100),
                'brake': round(brake_val * 100),
                'steering': round(steer, 1),
                'fuelLevel': round(fuel, 2),
                'gLateral': round(g_x, 2),
                'gLongitudinal': round(g_z, 2),
                'tireLF_temp': round(tire_temps[0], 1),
                'tireRF_temp': round(tire_temps[1], 1),
                'tireLR_temp': round(tire_temps[2], 1),
                'tireRR_temp': round(tire_temps[3], 1),
                'tireLF_wear': round((1 - tire_wear[0]) * 100, 1) if tire_wear[0] <= 1 else 0,
                'tireRF_wear': round((1 - tire_wear[1]) * 100, 1) if tire_wear[1] <= 1 else 0,
                'tireLR_wear': round((1 - tire_wear[2]) * 100, 1) if tire_wear[2] <= 1 else 0,
                'tireRR_wear': round((1 - tire_wear[3]) * 100, 1) if tire_wear[3] <= 1 else 0,
                'waterTemp': round(water_temp, 1),
                'oilPress': round(oil_press, 1),
                'absActive': abs_active,
            }
        except Exception:
            return {}

    def _read_graphics(self) -> dict:
        """Read session/UI data (ACC-specific)."""
        if not self._graphics_mmap:
            return {}
        self._graphics_mmap.seek(0)
        raw = self._graphics_mmap.read(600)

        try:
            status = struct.unpack_from('<i', raw, 0)[0]  # ACC_STATUS
            session = struct.unpack_from('<i', raw, 4)[0]  # ACC_SESSION_TYPE
            lap = struct.unpack_from('<i', raw, 12)[0]
            last_lap = struct.unpack_from('<i', raw, 16)[0]  # ms
            best_lap = struct.unpack_from('<i', raw, 20)[0]  # ms
            position = struct.unpack_from('<i', raw, 28)[0]
            current_time = struct.unpack_from('<i', raw, 36)[0]  # ms

            # ACC-specific fields
            track_pct = struct.unpack_from('<f', raw, 48)[0] if len(raw) > 52 else 0
            pit = struct.unpack_from('<i', raw, 56)[0] if len(raw) > 60 else 0

            # Weather and grip
            rain_intensity = struct.unpack_from('<f', raw, 200)[0] if len(raw) > 204 else 0
            track_grip = struct.unpack_from('<f', raw, 204)[0] if len(raw) > 208 else 1.0
            track_temp = struct.unpack_from('<f', raw, 208)[0] if len(raw) > 212 else 0
            air_temp = struct.unpack_from('<f', raw, 212)[0] if len(raw) > 216 else 0
            wind_speed = struct.unpack_from('<f', raw, 216)[0] if len(raw) > 220 else 0

            # Fuel pct
            fuel_pct = struct.unpack_from('<f', raw, 240)[0] if len(raw) > 244 else 0

            session_names = {0: 'Unknown', 1: 'Practice', 2: 'Qualify', 3: 'Race', 4: 'Hotlap'}
            track_states = {0: 'dry', 1: 'damp', 2: 'wet', 3: 'flooded'}
            grip_state = 'wet' if rain_intensity > 0.1 else 'dry'

            return {
                'lap': int(lap),
                'lastLapTime': round(last_lap / 1000, 3) if last_lap > 0 else 0,
                'bestLapTime': round(best_lap / 1000, 3) if best_lap > 0 else 0,
                'currentLapTime': round(current_time / 1000, 3) if current_time > 0 else 0,
                'position': int(position),
                'lapDistPct': round(track_pct * 100, 1),
                'onPitRoad': pit > 0,
                'isOnTrack': status == 2,
                'sessionName': session_names.get(session, 'Unknown'),
                'flags': ['green'] if status == 2 else [],
                'trackTemp': round(track_temp, 1),
                'airTemp': round(air_temp, 1),
                'windSpeed': round(wind_speed * 3.6, 1),
                'humidity': round(rain_intensity * 100, 0),
                'skies': 'Rain' if rain_intensity > 0.3 else 'Cloudy' if rain_intensity > 0.05 else 'Clear',
                'trackState': grip_state,
                'fuelPercent': round(fuel_pct * 100, 1) if fuel_pct > 0 else None,
                'tireCompound': 'DHE' if rain_intensity > 0.3 else 'DHD',  # ACC compound naming
            }
        except Exception:
            return {}

    def read_telemetry(self) -> dict:
        if not self.is_connected():
            return {
                "simulator": "acc",
                "connected": False,
                "waiting": True,
                "timestamp": time.time(),
                "fieldAvailability": self.field_availability,
            }

        physics = self._read_physics()
        graphics = self._read_graphics()

        result = {
            "simulator": "acc",
            "connected": True,
            "timestamp": time.time(),
            "fieldAvailability": self.field_availability,
            # Unavailable fields
            "drs": None, "classPosition": None, "handling": None,
            "understeerIndicator": None, "incidentCount": None,
            "driverIRating": None, "driverLicense": None,
            "deltaToSessionBest": None, "fuelUsePerHour": None,
            "oilTemp": None, "voltage": None, "shiftIndicator": None,
            "isOffTrack": None, "trackConfig": None, "carClass": None,
        }

        result.update(physics)
        result.update(graphics)
        result.update(self._static_info)
        result.setdefault('clutch', 0)
        result.setdefault('sessionLapsRemaining', 0)

        return result
