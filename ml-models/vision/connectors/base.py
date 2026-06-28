"""
Abstract base class for all simulator connectors.
Every connector must implement these methods to integrate with the Telemetry Server.
"""
from abc import ABC, abstractmethod


class BaseConnector(ABC):
    """Abstract base for all simulator connectors."""

    @property
    @abstractmethod
    def simulator_name(self) -> str:
        """Return simulator identifier: 'iracing' | 'f1_2024' | 'assetto_corsa' | 'acc'"""
        ...

    @property
    @abstractmethod
    def field_availability(self) -> dict[str, bool]:
        """Return mapping of field names to availability for this simulator."""
        ...

    @abstractmethod
    def connect(self) -> None:
        """
        Initialize connection to the simulator.
        Raises ConnectionError with descriptive message if simulator not running.
        """
        ...

    @abstractmethod
    def disconnect(self) -> None:
        """Clean up resources (close sockets, unmap memory, etc.)."""
        ...

    @abstractmethod
    def read_telemetry(self) -> dict:
        """
        Read one frame of telemetry.
        Returns a dict conforming to UnifiedTelemetry.
        Fields not available from this simulator MUST be set to None.
        Must be non-blocking (< 10ms execution time target).
        """
        ...

    @abstractmethod
    def is_connected(self) -> bool:
        """Return True if the simulator is actively providing data."""
        ...
