"""
Connector Registry — maps simulator IDs to their connector classes.
"""
from .base import BaseConnector
from .iracing import IRacingConnector
from .f1 import F1Connector
from .assetto_corsa import AssettoCorsaConnector
from .acc import ACCConnector

CONNECTOR_REGISTRY: dict[str, type[BaseConnector]] = {
    "iracing": IRacingConnector,
    "f1": F1Connector,
    "ac": AssettoCorsaConnector,
    "acc": ACCConnector,
}

# Auto-detect order (most popular first)
AUTO_DETECT_ORDER = ["iracing", "f1", "acc", "ac"]


def get_connector(simulator: str) -> BaseConnector:
    """Instantiate and return the connector for the given simulator ID."""
    cls = CONNECTOR_REGISTRY.get(simulator)
    if cls is None:
        valid = ", ".join(CONNECTOR_REGISTRY.keys())
        raise ValueError(f"Unknown simulator '{simulator}'. Valid options: {valid}")
    return cls()
