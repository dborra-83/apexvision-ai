"""
Assetto Corsa Connector — reads telemetry via Windows Shared Memory.
Maps: acpmf_physics, acpmf_graphics, acpmf_static
"""
import time
import struct
import ctypes
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from .base import BaseConnector
from schema.field_availability import FIELD_AVAILABILITY

try:
    import mmap
except ImportError:
    mmap = None


class AssettoCorsaConnector(BaseConnector):

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
        return 'assetto_corsa'

    @property
    def field_availability(self) -> dict[str, bool]:
        return FIELD_AVAILABILITY['assetto_corsa']

    def connect(self) -> None:
        try:
            self._physics_mmap = mmap.mmap(-1, 800, "Local\\acpmf_physics", access=mmap.ACCESS_READ)
            self._graphics_mmap = mmap.mmap(-1, 1580, "Local\\acpmf_graphics", access=mmap.ACCESS_READ)
            self._static_mmap = mmap.mmap(-1, 820, "Local\\acpmf_static", access=mmap.ACCESS_READ)
            self._connected = True
            self._read_static()
            print("[AC] Connected to Assetto Corsa shared memory")
        except Exception as e:
            raise ConnectionError(f"Assetto Corsa is not running or shared memory not available: {e}")

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
        """Read one-time static info (car, track, driver)."""
        if not self._static_mmap:
            return
        self._static_mmap.seek(0)
        raw = self._static_mmap.read(820)
        try:
            # Static struct: first field is smVersion (15 wchars = 30 bytes)
            # Car model at offset 30 (33 wchars), track at offset 96 (33 wchars)
            # Player name at offset 162 (33 wchars)
            car = raw[30:96].decode('utf-16-le', errors='ignore').rstrip('\x00')
            track = raw[96:162].decode('utf-16-le', errors='ignore').rstrip('\x00')
            player = raw[162:228].decode('utf-16-le', errors='ignore').rstrip('\x00')
            self._static_info = {'carName': car, 'trackName': track, 'driverName': player}
        except Exception:
            self._static_info = {}

    def _read_physics(self) -> dict:
        """Read real-time physics data."""
        if not self._physics_mmap:
            return {}
        self._physics_mmap.seek(0)
        raw = self._physics_mmap.read(200)  # Read first 200 bytes

        try:
            # Physics struct (simplified — key fields at known offsets)
            packet_id = struct.unpack_from('<i', raw, 0)[0]
            gas = struct.unpack_from('<f', raw, 4)[0]        # 0-1
            brake = struct.unpack_from('<f', raw, 8)[0]      # 0-1
            fuel = struct.unpack_from('<f', raw, 12)[0]      # liters
            gear = struct.unpack_from('<i', raw, 16)[0]      # 0=R, 1=N, 2=1st...
            rpm = struct.unpack_from('<i', raw, 20)[0]
            steer = struct.unpack_from('<f', raw, 24)[0]     # degrees
            speed = struct.unpack_from('<f', raw, 28)[0]     # km/h
            # G-forces at offset 68 (3 floats: x, y, z)
            g_x = struct.unpack_from('<f', raw, 68)[0]
            g_y = struct.unpack_from('<f', raw, 72)[0]
            g_z = struct.unpack_from('<f', raw, 76)[0]
            # Tire temps at offset 104 (4 floats: FL, FR, RL, RR)
            tire_temps = struct.unpack_from('<4f', raw, 104)

            # Check staleness
            if packet_id != self._last_packet_id:
                self._last_packet_id = packet_id
                self._last_update_time = time.time()

            # AC gear: 0=R, 1=N, 2=1st, 3=2nd... → convert to standard: -1=R, 0=N, 1=1st...
            std_gear = gear - 1 if gear >= 1 else -1

            return {
                'speed': round(speed, 1),
                'rpm': int(rpm),
                'gear': std_gear,
                'throttle': round(gas * 100),
                'brake': round(brake * 100),
                'steering': round(steer, 1),
                'fuelLevel': round(fuel, 2),
                'gLateral': round(g_x, 2),
                'gLongitudinal': round(g_z, 2),
                'tireLF_temp': round(tire_temps[0], 1),
                'tireRF_temp': round(tire_temps[1], 1),
                'tireLR_temp': round(tire_temps[2], 1),
                'tireRR_temp': round(tire_temps[3], 1),
                'absActive': struct.unpack_from('<f', raw, 136)[0] > 0 if len(raw) > 140 else False,
            }
        except Exception:
            return {}

    def _read_graphics(self) -> dict:
        """Read session/graphics data."""
        if not self._graphics_mmap:
            return {}
        self._graphics_mmap.seek(0)
        raw = self._graphics_mmap.read(400)

        try:
            # Graphics struct (simplified)
            status = struct.unpack_from('<i', raw, 0)[0]  # 0=OFF, 1=REPLAY, 2=LIVE, 3=PAUSE
            session = struct.unpack_from('<i', raw, 4)[0]  # 0=Unknown, 1=Practice, 2=Qualify, 3=Race
            lap = struct.unpack_from('<i', raw, 12)[0]
            last_lap = struct.unpack_from('<i', raw, 16)[0]  # ms
            best_lap = struct.unpack_from('<i', raw, 20)[0]  # ms
            position = struct.unpack_from('<i', raw, 28)[0]
            current_time = struct.unpack_from('<i', raw, 36)[0]  # ms
            # Track position pct at offset 48 (float 0-1)
            track_pct = struct.unpack_from('<f', raw, 48)[0] if len(raw) > 52 else 0
            pit = struct.unpack_from('<i', raw, 56)[0] if len(raw) > 60 else 0  # 0=none, 1=pit

            session_names = {0: 'Unknown', 1: 'Practice', 2: 'Qualify', 3: 'Race'}

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
            }
        except Exception:
            return {}

    def read_telemetry(self) -> dict:
        if not self.is_connected():
            return {
                "simulator": "assetto_corsa",
                "connected": False,
                "waiting": True,
                "timestamp": time.time(),
                "fieldAvailability": self.field_availability,
            }

        physics = self._read_physics()
        graphics = self._read_graphics()

        result = {
            "simulator": "assetto_corsa",
            "connected": True,
            "timestamp": time.time(),
            "fieldAvailability": self.field_availability,
            # Unavailable fields
            "tireLF_wear": None, "tireRF_wear": None, "tireLR_wear": None, "tireRR_wear": None,
            "tireCompound": None, "fuelPercent": None, "windSpeed": None, "humidity": None,
            "skies": None, "trackState": None, "drs": None, "classPosition": None,
            "handling": None, "understeerIndicator": None, "incidentCount": None,
            "driverIRating": None, "driverLicense": None, "deltaToSessionBest": None,
            "sessionLapsRemaining": None, "fuelUsePerHour": None, "oilTemp": None,
            "oilPress": None, "waterTemp": None, "voltage": None, "shiftIndicator": None,
            "isOffTrack": None, "trackConfig": None, "carClass": None,
        }

        result.update(physics)
        result.update(graphics)
        result.update(self._static_info)
        result.setdefault('clutch', 0)
        result.setdefault('airTemp', 0)
        result.setdefault('trackTemp', 0)

        return result
