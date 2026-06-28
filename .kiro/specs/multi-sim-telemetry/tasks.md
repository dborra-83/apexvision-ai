# Implementation Plan: Multi-Simulator Telemetry

## Overview

Refactor the monolithic `iracing_live.py` into a plugin-based connector architecture. Each racing simulator gets its own connector module that reads native telemetry and translates it to a unified JSON schema. The Telemetry Server becomes connector-agnostic, receiving standardized dictionaries from whichever connector is active.

## Tasks

- [ ] 1. Define schema and base abstractions
  - [ ] 1.1 Create the `UnifiedTelemetry` TypedDict and field constants in `ml-models/vision/schema/unified_telemetry.py`
    - Define the `UnifiedTelemetry` TypedDict with all fields (meta, core driving, lap/position, fuel, physics, tires, environment, status, session info, weather, handling)
    - Define `TELEMETRY_FIELDS` list of all non-meta field names for iteration
    - Create `__init__.py` exporting the schema
    - _Requirements: 2.1, 2.2, 2.5_

  - [ ] 1.2 Create the field availability maps in `ml-models/vision/schema/field_availability.py`
    - Define per-simulator `dict[str, bool]` maps (iRacing, F1, AC, ACC) declaring which fields each simulator provides
    - Export a `FIELD_AVAILABILITY` dict mapping simulator name to its availability map
    - _Requirements: 2.3, 9.3_

  - [ ] 1.3 Create the serializer module in `ml-models/vision/schema/serializer.py`
    - Implement `to_json(telemetry: dict) -> str` that handles None fields, float precision, and all supported types
    - Implement `from_json(json_str: str) -> dict` that deserializes back to a telemetry dict
    - Ensure round-trip correctness: `from_json(to_json(d)) == d`
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ] 1.4 Create the `BaseConnector` abstract class in `ml-models/vision/connectors/base.py`
    - Define ABC with abstract methods: `connect()`, `disconnect()`, `read_telemetry()`, `is_connected()`
    - Define abstract properties: `simulator_name`, `field_availability`
    - Create `connectors/__init__.py`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ] 1.5 Create the Connector Registry in `ml-models/vision/connectors/registry.py`
    - Implement `CONNECTOR_REGISTRY` dict mapping simulator IDs to connector classes
    - Implement `get_connector(simulator: str) -> BaseConnector` with clear ValueError for invalid IDs
    - _Requirements: 7.3_

- [ ] 2. Refactor existing code into modular structure
  - [ ] 2.1 Extract session recording logic into `ml-models/vision/recording/session_recorder.py`
    - Move `init_session_logging()`, `log_sample()`, `log_event()`, `save_lap_summary()`, `save_session_info()`, `close_session_logging()` from `iracing_live.py`
    - Adapt to accept any `UnifiedTelemetry` dict (not iRacing-specific)
    - Include the `simulator` field in `session_info.json`
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ] 2.2 Extract S3 upload logic into `ml-models/vision/recording/s3_uploader.py`
    - Move `upload_to_s3()` function
    - Ensure it works independently of the connector used
    - _Requirements: 8.5_

  - [ ] 2.3 Extract DynamoDB logic into `ml-models/vision/recording/dynamo_writer.py`
    - Move `init_dynamo()`, `_dynamo_save_sample()`, `_dynamo_save_lap_summary()` from `iracing_live.py`
    - Make it generic — operates on UnifiedTelemetry dicts
    - _Requirements: 8.1_

  - [ ] 2.4 Extract WebSocket server into `ml-models/vision/server/websocket_server.py`
    - Move WebSocket handler, client management, and broadcast logic
    - The broadcast loop accepts a `BaseConnector` instance and calls `read_telemetry()`
    - _Requirements: 2.5_

  - [ ] 2.5 Extract HTTP API into `ml-models/vision/server/http_api.py`
    - Move the HTTP sessions API and TTS proxy logic
    - Keep port 8766 behavior unchanged
    - _Requirements: 2.5_

- [ ] 3. Checkpoint - Ensure refactored structure compiles and imports cleanly
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement iRacing Connector
  - [ ] 4.1 Implement `IRacingConnector` in `ml-models/vision/connectors/iracing.py`
    - Port the `safe_read()` logic from `iracing_live.py` into `read_telemetry()`
    - Implement `connect()` using `irsdk.IRSDK().startup()`
    - Implement `disconnect()` to shut down the SDK
    - Implement `is_connected()` checking `ir.is_connected`
    - Map all iRacing fields to UnifiedTelemetry keys (same values as current output)
    - Handle the "not running" case: return `{"connected": False, "waiting": True}`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 4.2 Write property test for iRacing regression equivalence
    - **Property 4: iRacing Regression Equivalence**
    - Generate random irsdk state dicts, compare new connector output vs legacy `safe_read()` output
    - **Validates: Requirements 3.2, 3.4**

- [ ] 5. Implement F1 2024/2025 Connector
  - [ ] 5.1 Implement `F1Connector` in `ml-models/vision/connectors/f1.py`
    - Open a non-blocking UDP socket on port 20777
    - Decode packet types: Motion (0), Session (1), Lap Data (2), Car Telemetry (6), Car Status (7), Participants (4)
    - Detect packet format version from header byte offset 6 (`packetFormat` field)
    - Maintain internal buffer merging latest state from each packet type
    - Map decoded fields to UnifiedTelemetry (speed, rpm, gear, throttle, brake, steering, tire temps, tire wear, fuel, DRS, weather, lap times, position)
    - Handle 3-second timeout → `connected: false`
    - Handle malformed packets: log warning, skip, continue with last valid state
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 5.2 Write property test for F1 packet version detection
    - **Property 6: F1 Packet Version Detection**
    - Generate packets with varying version headers, verify correct decoder is selected
    - **Validates: Requirements 4.2, 4.5**

- [ ] 6. Implement Assetto Corsa Connector
  - [ ] 6.1 Implement `AssettoCorsaConnector` in `ml-models/vision/connectors/assetto_corsa.py`
    - Open mmap handles for `acpmf_physics`, `acpmf_graphics`, `acpmf_static`
    - Unpack struct data using `struct.unpack_from()`
    - Map AC fields to UnifiedTelemetry (set unavailable fields like DRS, ERS, weather to None)
    - Implement staleness detection: compare `packetId` between reads, 2-second timeout → `connected: false`
    - Raise `ConnectionError` if shared memory files don't exist
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 7. Implement ACC Connector
  - [ ] 7.1 Implement `ACCConnector` in `ml-models/vision/connectors/acc.py`
    - Open mmap handles for ACC-specific shared memory regions (different struct layouts than AC)
    - Unpack struct data with ACC-specific format strings and field offsets
    - Map ACC fields to UnifiedTelemetry including weather, track grip, tire pressures
    - Set unavailable fields (DRS, ERS) to None
    - Use same staleness detection pattern (2-second `packetId` timeout)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 8. Implement CLI and auto-detect
  - [ ] 8.1 Create the main entry point `ml-models/vision/telemetry_server.py`
    - Implement argparse CLI with `--simulator` (choices: iracing, f1, ac, acc; default: iracing) and `--auto-detect` flag
    - Use `get_connector()` from registry to instantiate the selected connector
    - Wire connector into the broadcast loop (WebSocket server + session recording + DynamoDB)
    - Log selected simulator name and connection parameters to stdout on startup
    - Handle invalid `--simulator` argument: print error with valid options and `sys.exit(1)`
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ] 8.2 Implement auto-detect mode in `ml-models/vision/telemetry_server.py`
    - Try each connector in sequence: iRacing → F1 → ACC → AC
    - Activate the first one that connects successfully
    - If none found: print "No simulator detected" message and retry every 10 seconds
    - _Requirements: 7.5_

  - [ ] 8.3 Create backward-compatibility wrapper in `ml-models/vision/iracing_live.py`
    - Replace the existing monolithic script with a thin wrapper that imports `telemetry_server` and runs with `--simulator iracing` defaults
    - Ensure `python iracing_live.py` still works exactly as before
    - _Requirements: 3.2, 3.4_

- [ ] 9. Checkpoint - Ensure all connectors load and CLI parses correctly
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Write property-based tests
  - [ ]* 10.1 Write property test for schema conformance in `ml-models/vision/tests/test_schema.py`
    - **Property 1: Schema Conformance**
    - Generate random simulator states per connector, validate output contains all required keys with correct types
    - **Validates: Requirements 1.2, 2.2, 4.3, 5.3, 6.3**

  - [ ]* 10.2 Write property test for unavailable field null consistency in `ml-models/vision/tests/test_schema.py`
    - **Property 2: Unavailable Field Null Consistency**
    - For each connector, verify fields marked unavailable are always None across many reads
    - **Validates: Requirements 1.3, 2.4, 9.2, 9.4**

  - [ ]* 10.3 Write property test for serialization round-trip in `ml-models/vision/tests/test_schema.py`
    - **Property 3: Serialization Round-Trip**
    - Generate random UnifiedTelemetry dicts with nulls/floats/ints/bools/strings/lists, assert `from_json(to_json(d)) == d`
    - **Validates: Requirements 10.3, 10.4**

  - [ ]* 10.4 Write property test for registry lookup in `ml-models/vision/tests/test_registry.py`
    - **Property 5: Registry Lookup Correctness**
    - Generate random strings, verify valid IDs return correct class, invalid IDs raise ValueError
    - **Validates: Requirements 7.3**

  - [ ]* 10.5 Write property test for session recording null preservation in `ml-models/vision/tests/test_schema.py`
    - **Property 7: Session Recording Null Preservation**
    - Generate dicts with None values, write to disk via session recorder, read back, assert nulls preserved
    - **Validates: Requirements 8.1, 8.3**

  - [ ]* 10.6 Write property test for field availability completeness in `ml-models/vision/tests/test_schema.py`
    - **Property 8: Field Availability Completeness**
    - Verify every connector's `fieldAvailability` dict contains an entry for every telemetry field, all booleans
    - **Validates: Requirements 2.3, 9.3**

- [ ] 11. Write unit tests
  - [ ]* 11.1 Write unit tests for connectors in `ml-models/vision/tests/test_connectors.py`
    - Test ABC compliance (all methods implemented per connector)
    - Test individual field mappings with concrete mock data per connector
    - Test error cases: sim not running, stale memory, UDP timeout
    - _Requirements: 1.1, 1.5, 4.4, 5.4, 5.5, 6.4_

  - [ ]* 11.2 Write unit tests for CLI in `ml-models/vision/tests/test_cli.py`
    - Test valid arguments (`--simulator iracing`, `--simulator f1`, etc.)
    - Test default (no argument → iracing)
    - Test invalid simulator name → error with valid options
    - Test `--auto-detect` flag
    - _Requirements: 7.1, 7.2, 7.3, 7.5_

  - [ ]* 11.3 Write unit tests for session recording in `ml-models/vision/tests/test_connectors.py`
    - Test session folder naming convention
    - Test JSONL file writing with null fields preserved
    - Test session_info.json includes `simulator` field
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 12. Integration wiring and final validation
  - [ ] 12.1 Wire all components together and verify end-to-end flow
    - Ensure `telemetry_server.py` correctly instantiates connector, starts WebSocket, starts recording, writes to DynamoDB
    - Verify the backward-compat `iracing_live.py` wrapper functions correctly
    - Update `ml-models/vision/requirements.txt` with all dependencies (hypothesis, pytest, pytest-asyncio, pyirsdk, websockets, boto3)
    - _Requirements: 7.1, 7.4, 8.5_

  - [ ]* 12.2 Write integration tests in `ml-models/vision/tests/test_integration.py`
    - Test full end-to-end: start server with mocked connector, verify WebSocket output matches UnifiedTelemetry schema
    - Test session recording: write session, verify file structure on disk
    - Test S3 upload: mock boto3, verify upload called with correct paths
    - _Requirements: 2.1, 2.2, 8.1, 8.5_

- [ ] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The iRacing connector is the reference implementation — all other connectors must produce the same JSON shape
- The existing `iracing_live.py` is preserved as a backward-compat wrapper

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4"] },
    { "id": 2, "tasks": ["1.5", "2.1", "2.2", "2.3"] },
    { "id": 3, "tasks": ["2.4", "2.5"] },
    { "id": 4, "tasks": ["4.1", "5.1", "6.1", "7.1"] },
    { "id": 5, "tasks": ["4.2", "5.2", "8.1"] },
    { "id": 6, "tasks": ["8.2", "8.3"] },
    { "id": 7, "tasks": ["10.1", "10.2", "10.3", "10.4", "10.5", "10.6"] },
    { "id": 8, "tasks": ["11.1", "11.2", "11.3"] },
    { "id": 9, "tasks": ["12.1"] },
    { "id": 10, "tasks": ["12.2"] }
  ]
}
```
