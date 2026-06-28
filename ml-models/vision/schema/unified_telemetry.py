"""
ApexVision AI — Unified Telemetry Schema
All connectors MUST produce dicts conforming to this schema.
Fields not available from a simulator MUST be set to None.
"""
from typing import TypedDict, Optional


class UnifiedTelemetry(TypedDict, total=False):
    # ── Meta (always present) ──
    simulator: str              # "iracing" | "f1_2024" | "assetto_corsa" | "acc"
    connected: bool
    timestamp: float            # Unix epoch
    fieldAvailability: dict     # {fieldName: bool}

    # ── Core Driving ──
    speed: Optional[float]      # km/h
    rpm: Optional[int]
    gear: Optional[int]         # -1=R, 0=N, 1-8=forward
    throttle: Optional[int]     # 0-100
    brake: Optional[int]        # 0-100
    clutch: Optional[int]       # 0-100
    steering: Optional[float]   # degrees

    # ── Lap / Position ──
    lap: Optional[int]
    lapDistPct: Optional[float]       # 0-100
    position: Optional[int]
    classPosition: Optional[int]
    lastLapTime: Optional[float]      # seconds
    bestLapTime: Optional[float]
    currentLapTime: Optional[float]
    deltaToSessionBest: Optional[float]
    sessionLapsRemaining: Optional[int]

    # ── Fuel ──
    fuelLevel: Optional[float]        # liters
    fuelPercent: Optional[float]      # 0-100
    fuelUsePerHour: Optional[float]

    # ── Physics ──
    gLateral: Optional[float]         # g
    gLongitudinal: Optional[float]

    # ── Tires ──
    tireLF_temp: Optional[float]      # °C
    tireRF_temp: Optional[float]
    tireLR_temp: Optional[float]
    tireRR_temp: Optional[float]
    tireLF_wear: Optional[float]      # 0-100 (pct worn)
    tireRF_wear: Optional[float]
    tireLR_wear: Optional[float]
    tireRR_wear: Optional[float]
    tireCompound: Optional[str]

    # ── Environment ──
    trackTemp: Optional[float]        # °C
    airTemp: Optional[float]
    windSpeed: Optional[float]        # km/h
    humidity: Optional[float]         # 0-100
    skies: Optional[str]
    trackState: Optional[str]         # "dry" | "wet" | ...
    flags: Optional[list]             # ["green","yellow",...]

    # ── Status ──
    onPitRoad: Optional[bool]
    isOnTrack: Optional[bool]
    isOffTrack: Optional[bool]
    drs: Optional[bool]
    absActive: Optional[bool]

    # ── Session Info ──
    trackName: Optional[str]
    trackConfig: Optional[str]
    sessionName: Optional[str]
    driverName: Optional[str]
    driverIRating: Optional[int]
    driverLicense: Optional[str]
    carName: Optional[str]
    carClass: Optional[str]

    # ── Handling / Dynamics ──
    handling: Optional[str]           # "understeer" | "oversteer" | "neutral"
    understeerIndicator: Optional[float]
    incidentCount: Optional[int]
    shiftIndicator: Optional[int]     # 0-100

    # ── Engine ──
    oilTemp: Optional[float]
    oilPress: Optional[float]
    waterTemp: Optional[float]
    voltage: Optional[float]


# All telemetry field names (excluding meta fields)
META_FIELDS = ['simulator', 'connected', 'timestamp', 'fieldAvailability']

TELEMETRY_FIELDS = [
    'speed', 'rpm', 'gear', 'throttle', 'brake', 'clutch', 'steering',
    'lap', 'lapDistPct', 'position', 'classPosition',
    'lastLapTime', 'bestLapTime', 'currentLapTime', 'deltaToSessionBest', 'sessionLapsRemaining',
    'fuelLevel', 'fuelPercent', 'fuelUsePerHour',
    'gLateral', 'gLongitudinal',
    'tireLF_temp', 'tireRF_temp', 'tireLR_temp', 'tireRR_temp',
    'tireLF_wear', 'tireRF_wear', 'tireLR_wear', 'tireRR_wear', 'tireCompound',
    'trackTemp', 'airTemp', 'windSpeed', 'humidity', 'skies', 'trackState', 'flags',
    'onPitRoad', 'isOnTrack', 'isOffTrack', 'drs', 'absActive',
    'trackName', 'trackConfig', 'sessionName', 'driverName', 'driverIRating', 'driverLicense', 'carName', 'carClass',
    'handling', 'understeerIndicator', 'incidentCount', 'shiftIndicator',
    'oilTemp', 'oilPress', 'waterTemp', 'voltage',
]
