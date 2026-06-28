"""
Per-simulator field availability maps.
True = simulator provides this field natively.
False = field will always be None for this simulator.
"""
from .unified_telemetry import TELEMETRY_FIELDS

# iRacing — provides almost everything
_IRACING = {f: True for f in TELEMETRY_FIELDS}

# F1 2024/2025 — no clutch, no classPosition, no handling calc, no incidents, no engine details
_F1 = {f: True for f in TELEMETRY_FIELDS}
_F1.update({
    'clutch': False,
    'classPosition': False,
    'handling': False,
    'understeerIndicator': False,
    'incidentCount': False,
    'absActive': False,
    'oilTemp': False,
    'oilPress': False,
    'waterTemp': False,
    'voltage': False,
    'driverIRating': False,
    'driverLicense': False,
    'isOffTrack': False,
})

# Assetto Corsa — no tire wear, no weather, no DRS, limited session info
_AC = {f: True for f in TELEMETRY_FIELDS}
_AC.update({
    'tireLF_wear': False,
    'tireRF_wear': False,
    'tireLR_wear': False,
    'tireRR_wear': False,
    'tireCompound': False,
    'fuelPercent': False,
    'windSpeed': False,
    'humidity': False,
    'skies': False,
    'trackState': False,
    'drs': False,
    'classPosition': False,
    'handling': False,
    'understeerIndicator': False,
    'incidentCount': False,
    'driverIRating': False,
    'driverLicense': False,
    'deltaToSessionBest': False,
    'sessionLapsRemaining': False,
    'fuelUsePerHour': False,
    'oilTemp': False,
    'oilPress': False,
    'waterTemp': False,
    'voltage': False,
    'shiftIndicator': False,
    'isOffTrack': False,
})

# ACC — better than AC, has weather and tire wear, but no DRS/ERS
_ACC = {f: True for f in TELEMETRY_FIELDS}
_ACC.update({
    'drs': False,
    'classPosition': False,
    'handling': False,
    'understeerIndicator': False,
    'incidentCount': False,
    'driverIRating': False,
    'driverLicense': False,
    'deltaToSessionBest': False,
    'fuelUsePerHour': False,
    'oilTemp': False,
    'voltage': False,
    'shiftIndicator': False,
    'isOffTrack': False,
})

FIELD_AVAILABILITY: dict[str, dict[str, bool]] = {
    'iracing': _IRACING,
    'f1_2024': _F1,
    'assetto_corsa': _AC,
    'acc': _ACC,
}
