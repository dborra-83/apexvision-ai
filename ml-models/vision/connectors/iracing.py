"""
iRacing Connector — reads telemetry via pyirsdk.
This is the reference implementation — all fields available.
"""
import time
import math
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from .base import BaseConnector
from schema.field_availability import FIELD_AVAILABILITY

try:
    import irsdk
except ImportError:
    irsdk = None


class IRacingConnector(BaseConnector):

    def __init__(self):
        self._ir = None
        self._connected = False

    @property
    def simulator_name(self) -> str:
        return 'iracing'

    @property
    def field_availability(self) -> dict[str, bool]:
        return FIELD_AVAILABILITY['iracing']

    def connect(self) -> None:
        if irsdk is None:
            raise ConnectionError("pyirsdk not installed. Run: pip install pyirsdk")
        self._ir = irsdk.IRSDK()
        if not self._ir.startup():
            raise ConnectionError("iRacing is not running. Start the simulator and retry.")
        self._connected = True

    def disconnect(self) -> None:
        if self._ir:
            self._ir.shutdown()
        self._connected = False

    def is_connected(self) -> bool:
        if self._ir is None:
            return False
        return self._ir.is_connected

    def read_telemetry(self) -> dict:
        if not self._ir or not self._ir.is_connected:
            # Try reconnect
            if self._ir and self._ir.startup():
                self._connected = True
            else:
                self._connected = False
                return {"simulator": "iracing", "connected": False, "waiting": True, "timestamp": time.time(), "fieldAvailability": self.field_availability}

        try:
            self._ir.freeze_var_buffer_latest()
        except Exception:
            pass

        speed_raw = self._ir['Speed']
        if speed_raw is None:
            return {"simulator": "iracing", "connected": True, "waiting": True, "noData": True, "timestamp": time.time(), "fieldAvailability": self.field_availability}

        data = {
            "simulator": "iracing",
            "connected": True,
            "timestamp": time.time(),
            "fieldAvailability": self.field_availability,
            "speed": round(float(speed_raw) * 3.6, 1),
            "rpm": round(float(self._ir['RPM'] or 0)),
            "gear": int(self._ir['Gear'] or 0),
            "throttle": round(float(self._ir['Throttle'] or 0) * 100),
            "brake": round(float(self._ir['Brake'] or 0) * 100),
            "clutch": round(float(self._ir['Clutch'] or 0) * 100),
            "steering": round(float(self._ir['SteeringWheelAngle'] or 0) * 57.3, 1),
            "lap": int(self._ir['Lap'] or 0),
            "lapDistPct": round(float(self._ir['LapDistPct'] or 0) * 100, 1),
            "position": int(self._ir['PlayerCarPosition'] or 0),
            "classPosition": int(self._ir['PlayerCarClassPosition'] or 0),
            "lastLapTime": round(float(self._ir['LapLastLapTime'] or 0), 3),
            "bestLapTime": round(float(self._ir['LapBestLapTime'] or 0), 3),
            "currentLapTime": round(float(self._ir['LapCurrentLapTime'] or 0), 3),
            "deltaToSessionBest": round(float(self._ir['LapDeltaToSessionBestLap'] or 0), 3),
            "sessionLapsRemaining": int(self._ir['SessionLapsRemainEx'] or 0),
            "fuelLevel": round(float(self._ir['FuelLevel'] or 0), 2),
            "fuelPercent": round(float(self._ir['FuelLevelPct'] or 0) * 100, 1),
            "fuelUsePerHour": round(float(self._ir['FuelUsePerHour'] or 0), 2),
            "gLateral": round(float(self._ir['LatAccel'] or 0), 2),
            "gLongitudinal": round(float(self._ir['LongAccel'] or 0), 2),
            "trackTemp": round(float(self._ir['TrackTempCrew'] or 0), 1),
            "airTemp": round(float(self._ir['AirTemp'] or 0), 1),
            "onPitRoad": bool(self._ir['OnPitRoad'] or False),
            "isOnTrack": bool(self._ir['IsOnTrack'] or False),
            "incidentCount": int(self._ir['PlayerCarMyIncidentCount'] or 0),
            "shiftIndicator": round(float(self._ir['ShiftIndicatorPct'] or 0) * 100),
        }

        # Handling
        try:
            speed_ms = float(self._ir['Speed'] or 0)
            if speed_ms > 5:
                steer_deg = float(self._ir['SteeringWheelAngle'] or 0) * 57.3
                yaw_rate = float(self._ir['YawRate'] or 0) * 57.3
                us_val = steer_deg - (yaw_rate * 2.5)
                data["understeerIndicator"] = round(us_val, 2)
                data["handling"] = "understeer" if us_val > 5 else "oversteer" if us_val < -5 else "neutral"
            else:
                data["handling"] = "neutral"
                data["understeerIndicator"] = 0
        except Exception:
            data["handling"] = "neutral"
            data["understeerIndicator"] = 0

        # ABS
        try:
            data["absActive"] = bool(self._ir['BrakeABSactive'])
        except Exception:
            data["absActive"] = False

        # Tire temps
        try:
            lf_i = float(self._ir['LFtempCL'] or 0)
            lf_m = float(self._ir['LFtempCM'] or 0)
            lf_o = float(self._ir['LFtempCR'] or 0)
            rf_i = float(self._ir['RFtempCL'] or 0)
            rf_m = float(self._ir['RFtempCM'] or 0)
            rf_o = float(self._ir['RFtempCR'] or 0)
            lr_i = float(self._ir['LRtempCL'] or 0)
            lr_m = float(self._ir['LRtempCM'] or 0)
            lr_o = float(self._ir['LRtempCR'] or 0)
            rr_i = float(self._ir['RRtempCL'] or 0)
            rr_m = float(self._ir['RRtempCM'] or 0)
            rr_o = float(self._ir['RRtempCR'] or 0)
            data["tireLF_temp"] = round((lf_i + lf_m + lf_o) / 3, 1)
            data["tireRF_temp"] = round((rf_i + rf_m + rf_o) / 3, 1)
            data["tireLR_temp"] = round((lr_i + lr_m + lr_o) / 3, 1)
            data["tireRR_temp"] = round((rr_i + rr_m + rr_o) / 3, 1)
        except Exception:
            data["tireLF_temp"] = 0
            data["tireRF_temp"] = 0
            data["tireLR_temp"] = 0
            data["tireRR_temp"] = 0

        # Tire wear
        try:
            data["tireLF_wear"] = round((1 - float(self._ir['LFwearM'] or 1)) * 100, 1)
            data["tireRF_wear"] = round((1 - float(self._ir['RFwearM'] or 1)) * 100, 1)
            data["tireLR_wear"] = round((1 - float(self._ir['LRwearM'] or 1)) * 100, 1)
            data["tireRR_wear"] = round((1 - float(self._ir['RRwearM'] or 1)) * 100, 1)
        except Exception:
            pass

        # Engine
        try:
            data["oilTemp"] = round(float(self._ir['OilTemp'] or 0), 1)
            data["oilPress"] = round(float(self._ir['OilPress'] or 0), 1)
            data["waterTemp"] = round(float(self._ir['WaterTemp'] or 0), 1)
            data["voltage"] = round(float(self._ir['Voltage'] or 0), 1)
        except Exception:
            pass

        # Tire compound
        try:
            data["tireCompound"] = str(self._ir.get('PlayerTireCompound', '') or 'Unknown')
        except Exception:
            data["tireCompound"] = "Unknown"

        # Off-track
        try:
            ts = int(self._ir.get('PlayerTrackSurface', 3) or 3)
            data["isOffTrack"] = ts == 0 and data["isOnTrack"] and not data["onPitRoad"]
        except Exception:
            data["isOffTrack"] = False

        # DRS
        try:
            data["drs"] = bool(self._ir.get('DRS_Status', 0))
        except Exception:
            data["drs"] = False

        # Flags
        try:
            fl = self._ir['SessionFlags'] or 0
            data["flags"] = []
            if fl & 0x0004: data["flags"].append("green")
            if fl & 0x0010: data["flags"].append("yellow")
            if fl & 0x0020: data["flags"].append("red")
            if fl & 0x0080: data["flags"].append("blue")
            if fl & 0x0200: data["flags"].append("checkered")
        except Exception:
            data["flags"] = []

        # Session info
        try:
            wi = self._ir['WeekendInfo']
            if wi:
                data["trackName"] = wi.get('TrackDisplayName', '') or wi.get('TrackName', '')
                data["trackConfig"] = wi.get('TrackConfigName', '')
                data["windSpeed"] = round(float(self._ir.get('WindVel', 0) or 0) * 3.6, 1)
                data["humidity"] = round(float(self._ir.get('RelativeHumidity', 0) or 0), 0)
                data["skies"] = str(self._ir.get('Skies', '') or '')
                data["trackState"] = str(self._ir.get('TrackWetness', '') or 'dry')
        except Exception:
            pass

        # Driver info
        try:
            di = self._ir['DriverInfo']
            if di:
                drivers = di.get('Drivers', [])
                idx = int(self._ir['PlayerCarIdx'] or 0)
                if drivers and idx < len(drivers):
                    d = drivers[idx]
                    data["driverName"] = d.get('UserName', '')
                    data["driverIRating"] = d.get('IRating', 0)
                    data["driverLicense"] = d.get('LicString', '')
                    data["carName"] = d.get('CarScreenName', '') or d.get('CarPath', '')
                    data["carClass"] = d.get('CarClassShortName', '')
        except Exception:
            pass

        # Session name
        try:
            si = self._ir['SessionInfo']
            if si:
                sessions = si.get('Sessions', [])
                sn = int(self._ir['SessionNum'] or 0)
                if sessions and sn < len(sessions):
                    data["sessionName"] = sessions[sn].get('SessionName', '')
        except Exception:
            pass

        return data
