"""
JSON serialization for UnifiedTelemetry with proper null handling.
Guarantees round-trip: from_json(to_json(d)) == d
"""
import json


def to_json(telemetry: dict) -> str:
    """Serialize a telemetry dict to JSON string. None values are preserved as null."""
    return json.dumps(telemetry, separators=(',', ':'))


def from_json(json_str: str) -> dict:
    """Deserialize JSON string back to telemetry dict. null becomes None."""
    return json.loads(json_str)
