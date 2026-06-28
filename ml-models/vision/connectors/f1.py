"""
F1 2024/2025 Connector — reads telemetry via UDP (Codemasters/EA protocol).
Receives broadcast packets on port 20777.
"""
import time
import socket
import struct
import threading
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from .base import BaseConnector
from schema.field_availability import FIELD_AVAILABILITY

UDP_PORT = 20777
TIMEOUT_SECONDS = 3


class F1Connector(BaseConnector):

    def __init__(self, port: int = UDP_PORT):
        self._port = port
        self._sock: socket.socket | None = None
        self._connected = False
        self._last_packet_time = 0
        self._state: dict = {}  # Merged state from all packet types
        self._listener_thread: threading.Thread | None = None
        self._running = False

    @property
    def simulator_name(self) -> str:
        return 'f1_2024'

    @property
    def field_availability(self) -> dict[str, bool]:
        return FIELD_AVAILABILITY['f1_2024']

    def connect(self) -> None:
        self._sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self._sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._sock.bind(('0.0.0.0', self._port))
        self._sock.settimeout(1.0)
        self._running = True
        self._listener_thread = threading.Thread(target=self._listen, daemon=True)
        self._listener_thread.start()
        print(f"[F1] Listening on UDP port {self._port}")

    def disconnect(self) -> None:
        self._running = False
        if self._sock:
            self._sock.close()
            self._sock = None
        self._connected = False

    def is_connected(self) -> bool:
        if time.time() - self._last_packet_time > TIMEOUT_SECONDS:
            self._connected = False
        return self._connected

    def _listen(self):
        """Background thread receiving UDP packets."""
        while self._running and self._sock:
            try:
                data, _ = self._sock.recvfrom(4096)
                self._last_packet_time = time.time()
                self._connected = True
                self._decode_packet(data)
            except socket.timeout:
                continue
            except OSError:
                break
            except Exception as e:
                print(f"[F1] Packet error: {e}")
                continue

    def _decode_packet(self, data: bytes):
        """Decode F1 UDP packet and merge into state."""
        if len(data) < 24:
            return  # Too small for header

        # Header (24 bytes)
        # uint16 packetFormat, uint8 gameYear, uint8 gameMajorVersion, ...
        # uint8 packetId at offset 5
        try:
            packet_format = struct.unpack_from('<H', data, 0)[0]  # 2023, 2024, 2025
            packet_id = struct.unpack_from('<B', data, 5)[0]
            player_car_idx = struct.unpack_from('<B', data, 21)[0]
        except Exception:
            return

        self._state['_packetFormat'] = packet_format

        try:
            if packet_id == 6:  # Car Telemetry
                self._decode_car_telemetry(data, player_car_idx)
            elif packet_id == 7:  # Car Status
                self._decode_car_status(data, player_car_idx)
            elif packet_id == 2:  # Lap Data
                self._decode_lap_data(data, player_car_idx)
            elif packet_id == 1:  # Session
                self._decode_session(data)
            elif packet_id == 0:  # Motion
                self._decode_motion(data, player_car_idx)
            elif packet_id == 4:  # Participants
                self._decode_participants(data, player_car_idx)
        except Exception as e:
            print(f"[F1] Decode error (pkt {packet_id}): {e}")

    def _decode_car_telemetry(self, data: bytes, idx: int):
        """Packet ID 6 — speed, rpm, gear, throttle, brake, steering, tire temps."""
        # Each car's telemetry is 60 bytes, starts at offset 24
        offset = 24 + idx * 60
        if len(data) < offset + 60:
            return
        speed = struct.unpack_from('<H', data, offset)[0]  # km/h
        throttle = struct.unpack_from('<f', data, offset + 2)[0] * 100
        steering = struct.unpack_from('<f', data, offset + 6)[0]  # -1 to 1 → degrees
        brake = struct.unpack_from('<f', data, offset + 10)[0] * 100
        gear = struct.unpack_from('<b', data, offset + 14)[0]  # -1=R, 0=N, 1-8
        rpm = struct.unpack_from('<H', data, offset + 15)[0]

        # Tire temps (surface) — 4 floats at offset 17
        tire_temps = struct.unpack_from('<4f', data, offset + 17)

        self._state.update({
            'speed': round(float(speed), 1),
            'throttle': round(throttle),
            'brake': round(brake),
            'steering': round(steering * 180, 1),  # Normalize to degrees
            'gear': int(gear),
            'rpm': int(rpm),
            'tireLF_temp': round(tire_temps[0], 1),
            'tireRF_temp': round(tire_temps[1], 1),
            'tireLR_temp': round(tire_temps[2], 1),
            'tireRR_temp': round(tire_temps[3], 1),
        })

    def _decode_car_status(self, data: bytes, idx: int):
        """Packet ID 7 — fuel, tire wear, DRS, flags."""
        # Simplified — actual struct varies by game year
        offset = 24 + idx * 47
        if len(data) < offset + 47:
            return
        try:
            fuel_mix = struct.unpack_from('<B', data, offset)[0]
            fuel_level = struct.unpack_from('<f', data, offset + 1)[0]
            drs = struct.unpack_from('<B', data, offset + 10)[0]  # 0=off, 1=available, 2=active
            # Tire wear — 4 bytes at offset 11 (0-100)
            wear = struct.unpack_from('<4B', data, offset + 11)
            self._state.update({
                'fuelLevel': round(fuel_level, 2),
                'fuelPercent': round(fuel_level * 100 / max(1, self._state.get('_fuelCapacity', 100)), 1),
                'drs': drs > 0,
                'tireLF_wear': int(wear[0]),
                'tireRF_wear': int(wear[1]),
                'tireLR_wear': int(wear[2]),
                'tireRR_wear': int(wear[3]),
            })
        except Exception:
            pass

    def _decode_lap_data(self, data: bytes, idx: int):
        """Packet ID 2 — lap times, position."""
        offset = 24 + idx * 43
        if len(data) < offset + 43:
            return
        try:
            last_lap_ms = struct.unpack_from('<I', data, offset)[0]
            current_lap_ms = struct.unpack_from('<I', data, offset + 4)[0]
            best_lap_ms = struct.unpack_from('<I', data, offset + 12)[0]
            lap_num = struct.unpack_from('<B', data, offset + 28)[0]
            position = struct.unpack_from('<B', data, offset + 29)[0]
            pit_status = struct.unpack_from('<B', data, offset + 30)[0]
            lap_dist_pct = struct.unpack_from('<f', data, offset + 8)[0]  # Normalized 0-1

            self._state.update({
                'lastLapTime': round(last_lap_ms / 1000, 3) if last_lap_ms > 0 else 0,
                'currentLapTime': round(current_lap_ms / 1000, 3) if current_lap_ms > 0 else 0,
                'bestLapTime': round(best_lap_ms / 1000, 3) if best_lap_ms > 0 else 0,
                'lap': int(lap_num),
                'position': int(position),
                'onPitRoad': pit_status > 0,
                'lapDistPct': round(lap_dist_pct * 100, 1),
            })
        except Exception:
            pass

    def _decode_session(self, data: bytes):
        """Packet ID 1 — weather, track temp."""
        if len(data) < 50:
            return
        try:
            weather_id = struct.unpack_from('<B', data, 24)[0]
            track_temp = struct.unpack_from('<b', data, 25)[0]
            air_temp = struct.unpack_from('<b', data, 26)[0]
            total_laps = struct.unpack_from('<B', data, 27)[0]

            weather_map = {0: 'Clear', 1: 'Light Cloud', 2: 'Overcast', 3: 'Light Rain', 4: 'Heavy Rain', 5: 'Storm'}
            self._state.update({
                'trackTemp': float(track_temp),
                'airTemp': float(air_temp),
                'skies': weather_map.get(weather_id, 'Unknown'),
                'sessionLapsRemaining': max(0, total_laps - self._state.get('lap', 0)),
                'windSpeed': round(struct.unpack_from('<f', data, 28)[0] * 3.6, 1) if len(data) > 32 else 0,
                'humidity': struct.unpack_from('<B', data, 32)[0] if len(data) > 33 else 0,
            })
        except Exception:
            pass

    def _decode_motion(self, data: bytes, idx: int):
        """Packet ID 0 — g-forces."""
        offset = 24 + idx * 60
        if len(data) < offset + 60:
            return
        try:
            g_lat = struct.unpack_from('<f', data, offset + 16)[0]
            g_lon = struct.unpack_from('<f', data, offset + 20)[0]
            self._state.update({
                'gLateral': round(g_lat, 2),
                'gLongitudinal': round(g_lon, 2),
            })
        except Exception:
            pass

    def _decode_participants(self, data: bytes, idx: int):
        """Packet ID 4 — driver name, track."""
        try:
            # Number of active cars
            num_cars = struct.unpack_from('<B', data, 24)[0]
            # Each participant: 54 bytes starting at offset 25
            p_offset = 25 + idx * 54
            if len(data) < p_offset + 54:
                return
            name_bytes = data[p_offset + 2: p_offset + 50]
            name = name_bytes.split(b'\x00')[0].decode('utf-8', errors='ignore')
            self._state['driverName'] = name
        except Exception:
            pass

    def read_telemetry(self) -> dict:
        if not self.is_connected():
            return {
                "simulator": "f1_2024",
                "connected": False,
                "waiting": True,
                "timestamp": time.time(),
                "fieldAvailability": self.field_availability,
            }

        result = {
            "simulator": "f1_2024",
            "connected": True,
            "timestamp": time.time(),
            "fieldAvailability": self.field_availability,
            "isOnTrack": True,
            # Fields not available for F1
            "clutch": None,
            "classPosition": None,
            "handling": None,
            "understeerIndicator": None,
            "incidentCount": None,
            "absActive": None,
            "oilTemp": None,
            "oilPress": None,
            "waterTemp": None,
            "voltage": None,
            "driverIRating": None,
            "driverLicense": None,
            "isOffTrack": None,
            "tireCompound": "Unknown",
            "trackState": None,
            "trackConfig": None,
            "carClass": None,
            "deltaToSessionBest": None,
            "fuelUsePerHour": None,
            "shiftIndicator": None,
        }

        # Merge available state
        for key in ['speed', 'rpm', 'gear', 'throttle', 'brake', 'steering',
                    'lap', 'lapDistPct', 'position', 'lastLapTime', 'bestLapTime',
                    'currentLapTime', 'fuelLevel', 'fuelPercent', 'drs',
                    'gLateral', 'gLongitudinal', 'trackTemp', 'airTemp',
                    'tireLF_temp', 'tireRF_temp', 'tireLR_temp', 'tireRR_temp',
                    'tireLF_wear', 'tireRF_wear', 'tireLR_wear', 'tireRR_wear',
                    'onPitRoad', 'driverName', 'sessionLapsRemaining',
                    'skies', 'windSpeed', 'humidity', 'flags']:
            if key in self._state:
                result[key] = self._state[key]
            elif key not in result:
                result[key] = None

        # Derive missing
        result.setdefault('flags', [])
        result.setdefault('trackName', 'F1 Circuit')
        result.setdefault('sessionName', 'Race')
        result.setdefault('carName', 'F1 Car')

        return result
