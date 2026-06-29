"""
Assetto Corsa Competizione Connector — reads telemetry via Windows Shared Memory.

ACC exposes 3 memory-mapped files:
- Local\\acpmf_physics   (SPageFilePhysics)  — real-time physics
- Local\\acpmf_graphics  (SPageFileGraphic)  — session/UI state  
- Local\\acpmf_static    (SPageFileStatic)   — one-time car/track info

Reference: ACC Shared Memory documentation by Kunos Simulazioni
Struct sizes: Physics=712, Graphics=1580, Static=820 (ACC 1.8+)
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

# ACC Shared Memory sizes (from ACC SDK)
PHYSICS_SIZE = 712
GRAPHICS_SIZE = 1580
STATIC_SIZE = 820


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
        if mmap is None:
            raise ConnectionError("mmap module not available")
        try:
            self._physics_mmap = mmap.mmap(-1, PHYSICS_SIZE, "Local\\acpmf_physics", access=mmap.ACCESS_READ)
            self._graphics_mmap = mmap.mmap(-1, GRAPHICS_SIZE, "Local\\acpmf_graphics", access=mmap.ACCESS_READ)
            self._static_mmap = mmap.mmap(-1, STATIC_SIZE, "Local\\acpmf_static", access=mmap.ACCESS_READ)
            self._connected = True
            self._read_static()
            print("[ACC] Connected to ACC shared memory")
            print(f"[ACC] Car: {self._static_info.get('carName', '?')}, Track: {self._static_info.get('trackName', '?')}")
        except Exception as e:
            raise ConnectionError(f"ACC is not running or not in a session. Start a practice/race session first. Error: {e}")

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
        """Read SPageFileStatic — one-time info (car, track, driver)."""
        if not self._static_mmap:
            return
        try:
            self._static_mmap.seek(0)
            raw = self._static_mmap.read(STATIC_SIZE)
            
            # SPageFileStatic layout (ACC):
            # offset 0: smVersion (15 wchar = 30 bytes)
            # offset 30: acVersion (15 wchar = 30 bytes)
            # offset 60: numberOfSessions (int)
            # offset 64: numCars (int)  
            # offset 68: carModel (33 wchar = 66 bytes)
            # offset 134: track (33 wchar = 66 bytes)
            # offset 200: playerName (33 wchar = 66 bytes)
            # offset 266: playerSurname (33 wchar = 66 bytes)
            # offset 332: playerNick (33 wchar = 66 bytes)
            
            car = raw[68:134].decode('utf-16-le', errors='ignore').split('\x00')[0].strip()
            track = raw[134:200].decode('utf-16-le', errors='ignore').split('\x00')[0].strip()
            player = raw[200:266].decode('utf-16-le', errors='ignore').split('\x00')[0].strip()
            surname = raw[266:332].decode('utf-16-le', errors='ignore').split('\x00')[0].strip()
            
            driver_name = f"{player} {surname}".strip() if surname else player
            
            self._static_info = {
                'carName': car or 'Unknown',
                'trackName': track or 'Unknown',
                'driverName': driver_name or 'Unknown',
            }
        except Exception as e:
            print(f"[ACC] Error reading static: {e}")
            self._static_info = {}

    def _read_physics(self) -> dict:
        """Read SPageFilePhysics — real-time physics data."""
        if not self._physics_mmap:
            return {}
        try:
            self._physics_mmap.seek(0)
            raw = self._physics_mmap.read(PHYSICS_SIZE)
            
            # SPageFilePhysics layout (ACC):
            # offset 0:   packetId (int)
            # offset 4:   gas (float) 0-1
            # offset 8:   brake (float) 0-1
            # offset 12:  fuel (float) liters
            # offset 16:  gear (int) 0=R, 1=N, 2=1st...
            # offset 20:  rpms (int)
            # offset 24:  steerAngle (float) degrees
            # offset 28:  speedKmh (float)
            # offset 32:  velocity[3] (3 floats) — world velocity
            # offset 44:  accG[3] (3 floats) — g-forces: x=lat, y=up, z=lon
            # offset 56:  wheelSlip[4] (4 floats)
            # offset 72:  wheelLoad[4] (4 floats) — not used
            # offset 88:  wheelsPressure[4] (4 floats)
            # offset 104: wheelAngularSpeed[4] (4 floats)
            # offset 120: tyreSurfaceTemp[4] (4 floats) — SURFACE temps FL,FR,RL,RR (not available in ACC, use tyreTemp)
            # offset 136: tyreCoreTemp[4] (4 floats) — CORE temps FL,FR,RL,RR  
            # offset 152: padLife[4] (4 floats) — brake pad life
            # offset 168: brakeTemp[4] (4 floats) — brake disc temps
            # ...
            # offset 256: abs (float) — ABS vibrations (>0 = active)
            # offset 292: autoshifterOn (int)
            # offset 320: turboBoost (float)
            # offset 356: airTemp (float)
            # offset 360: roadTemp (float)  
            # offset 392: brakeTemp[4] (repeated or additional)
            # offset 472: waterTemp (float)
            # offset 500: brakeBias (float)

            packet_id = struct.unpack_from('<i', raw, 0)[0]
            gas = struct.unpack_from('<f', raw, 4)[0]
            brake_val = struct.unpack_from('<f', raw, 8)[0]
            fuel = struct.unpack_from('<f', raw, 12)[0]
            gear = struct.unpack_from('<i', raw, 16)[0]  # 0=R, 1=N, 2=1st
            rpms = struct.unpack_from('<i', raw, 20)[0]
            steer = struct.unpack_from('<f', raw, 24)[0]
            speed = struct.unpack_from('<f', raw, 28)[0]
            
            # G-forces (offset 44): x=lateral, y=vertical, z=longitudinal
            g_x = struct.unpack_from('<f', raw, 44)[0]
            g_y = struct.unpack_from('<f', raw, 48)[0]
            g_z = struct.unpack_from('<f', raw, 52)[0]
            
            # Tire core temps (offset 136): FL, FR, RL, RR
            tire_temps = struct.unpack_from('<4f', raw, 136)
            
            # Wheel slip for wear estimation (offset 56)
            # Brake temps (offset 168)
            brake_temps = struct.unpack_from('<4f', raw, 168)
            
            # ABS (offset 256)
            abs_val = struct.unpack_from('<f', raw, 256)[0]
            
            # Check staleness
            if packet_id != self._last_packet_id:
                self._last_packet_id = packet_id
                self._last_update_time = time.time()

            # Gear conversion: ACC 0=R, 1=N, 2=1st → standard -1=R, 0=N, 1=1st
            std_gear = gear - 1 if gear >= 1 else -1

            return {
                'speed': round(speed, 1),
                'rpm': int(rpms),
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
                'absActive': abs_val > 0,
                'oilPress': round(brake_temps[0], 1) if brake_temps[0] < 1000 else 0,  # placeholder
            }
        except Exception as e:
            print(f"[ACC] Physics read error: {e}")
            return {}

    def _read_graphics(self) -> dict:
        """Read SPageFileGraphic — session/UI state."""
        if not self._graphics_mmap:
            return {}
        try:
            self._graphics_mmap.seek(0)
            raw = self._graphics_mmap.read(GRAPHICS_SIZE)
            
            # SPageFileGraphic layout (ACC):
            # offset 0:   packetId (int)
            # offset 4:   status (int) — AC_STATUS: 0=OFF, 1=REPLAY, 2=LIVE, 3=PAUSE
            # offset 8:   session (int) — AC_SESSION_TYPE: 0=Unknown, 1=Practice, 2=Qualify, 3=Race
            # offset 12:  currentTime (wchar[15] = 30 bytes) — string lap time
            # offset 42:  lastTime (wchar[15] = 30 bytes)
            # offset 72:  bestTime (wchar[15] = 30 bytes)
            # offset 102: split (wchar[15] = 30 bytes)
            # offset 132: completedLaps (int)
            # offset 136: position (int)
            # offset 140: iCurrentTime (int) — current lap time in ms
            # offset 144: iLastTime (int) — last lap time in ms
            # offset 148: iBestTime (int) — best lap time in ms
            # offset 152: sessionTimeLeft (float) — session time remaining in ms
            # offset 156: distanceTraveled (float)
            # offset 160: isInPit (int)
            # offset 164: currentSectorIndex (int)
            # offset 168: lastSectorTime (int) ms
            # offset 172: numberOfLaps (int)
            # offset 176: tyreCompound (wchar[33] = 66 bytes)
            # offset 244: normalizedCarPosition (float) — 0-1 track position
            # offset 248: activeCars (int)
            # ...
            # offset 324: isInPitLane (int)
            # offset 380: rainIntensity (int) — ACC_RAIN_INTENSITY
            # offset 388: trackGripStatus (int) — ACC_TRACK_GRIP_STATUS
            
            status = struct.unpack_from('<i', raw, 4)[0]
            session_type = struct.unpack_from('<i', raw, 8)[0]
            completed_laps = struct.unpack_from('<i', raw, 132)[0]
            position = struct.unpack_from('<i', raw, 136)[0]
            i_current_time = struct.unpack_from('<i', raw, 140)[0]  # ms
            i_last_time = struct.unpack_from('<i', raw, 144)[0]     # ms
            i_best_time = struct.unpack_from('<i', raw, 148)[0]     # ms
            is_in_pit = struct.unpack_from('<i', raw, 160)[0]
            normalized_pos = struct.unpack_from('<f', raw, 244)[0]  # 0-1
            
            # Tyre compound (offset 176, 33 wchar)
            compound_raw = raw[176:242].decode('utf-16-le', errors='ignore').split('\x00')[0].strip()
            
            session_names = {0: 'Unknown', 1: 'Practice', 2: 'Qualifying', 3: 'Race', 4: 'Hotlap', 5: 'Time Attack', 6: 'Drift', 7: 'Drag'}

            return {
                'lap': completed_laps + 1,  # current lap
                'lastLapTime': round(i_last_time / 1000, 3) if i_last_time > 0 else 0,
                'bestLapTime': round(i_best_time / 1000, 3) if i_best_time > 0 else 0,
                'currentLapTime': round(i_current_time / 1000, 3) if i_current_time > 0 else 0,
                'position': int(position),
                'lapDistPct': round(normalized_pos * 100, 1),
                'onPitRoad': is_in_pit > 0,
                'isOnTrack': status == 2,
                'sessionName': session_names.get(session_type, 'Unknown'),
                'tireCompound': compound_raw or 'Unknown',
                'flags': ['green'] if status == 2 else [],
            }
        except Exception as e:
            print(f"[ACC] Graphics read error: {e}")
            return {}

    def read_telemetry(self) -> dict:
        if not self._connected:
            # Try to reconnect
            try:
                self.connect()
            except ConnectionError:
                return {
                    "simulator": "acc",
                    "connected": False,
                    "waiting": True,
                    "timestamp": time.time(),
                    "fieldAvailability": self.field_availability,
                }

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
            # Fields ACC doesn't provide
            "drs": None, "classPosition": None, "handling": None,
            "understeerIndicator": None, "incidentCount": None,
            "driverIRating": None, "driverLicense": None,
            "deltaToSessionBest": None, "fuelUsePerHour": None,
            "oilTemp": None, "voltage": None, "shiftIndicator": None,
            "isOffTrack": None, "trackConfig": None, "carClass": None,
            "windSpeed": None, "humidity": None, "skies": None,
            "trackState": None, "trackTemp": None, "airTemp": None,
            "waterTemp": None, "sessionLapsRemaining": None,
            "fuelPercent": None,
        }

        result.update(physics)
        result.update(graphics)
        result.update(self._static_info)
        result.setdefault('clutch', 0)

        # Calculate fuel percent if we have fuel level
        fuel = result.get('fuelLevel', 0)
        if fuel and fuel > 0:
            # ACC doesn't give max fuel easily, estimate from common tank sizes (120L GT3)
            result['fuelPercent'] = round(min(100, fuel / 120 * 100), 1)

        return result
