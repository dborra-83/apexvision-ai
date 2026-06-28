# Requirements Document

## Introduction

ApexVision AI currently supports only iRacing telemetry via the `iracing_live.py` script. This feature extends the platform to support multiple racing simulators (F1 2024/2025, Assetto Corsa, Assetto Corsa Competizione) through a connector architecture that translates each game's native telemetry into a unified JSON format. The frontend remains unchanged — each connector handles the translation transparently.

## Glossary

- **Connector**: A Python module that reads native telemetry from a specific racing simulator and translates the data into the Unified_Telemetry_Format
- **Unified_Telemetry_Format**: The standardized JSON schema that all connectors produce and the frontend consumes (matching the existing iRacing format)
- **Telemetry_Server**: The Python process that runs a selected Connector, broadcasts data via WebSocket on port 8765, and serves the sessions HTTP API on port 8766
- **Shared_Memory**: A Windows IPC mechanism where a simulator writes telemetry into a memory-mapped file that external processes can read
- **UDP_Telemetry**: A network protocol where a simulator broadcasts binary telemetry packets to a configured port
- **Session_Recorder**: The subsystem that writes telemetry samples to disk (JSONL format) and uploads completed sessions to S3
- **Connector_Registry**: A mapping of supported simulator identifiers to their corresponding Connector implementations
- **Null_Value**: A sentinel (null in JSON) indicating that the source simulator does not provide a particular telemetry field

## Requirements

### Requirement 1: Connector Abstraction Layer

**User Story:** As a developer, I want a common interface that all simulator connectors implement, so that the Telemetry_Server can work with any simulator without game-specific logic in the broadcast loop.

#### Acceptance Criteria

1. THE Connector SHALL define a common Python interface with methods: `connect()`, `disconnect()`, `read_telemetry()`, and `is_connected()`
2. WHEN `read_telemetry()` is called, THE Connector SHALL return a dictionary conforming to the Unified_Telemetry_Format
3. WHEN a Connector cannot provide a value for a field defined in the Unified_Telemetry_Format, THE Connector SHALL set that field to Null_Value
4. THE Connector SHALL expose a `simulator_name` property that returns a string identifier (one of: "iracing", "f1_2024", "assetto_corsa", "acc")
5. IF `connect()` fails due to the simulator not running, THEN THE Connector SHALL raise a descriptive exception without crashing the Telemetry_Server

### Requirement 2: Unified Telemetry Format Specification

**User Story:** As a frontend developer, I want all simulators to produce the same JSON structure, so that the dashboard works without modification regardless of which game is connected.

#### Acceptance Criteria

1. THE Unified_Telemetry_Format SHALL include a `simulator` field identifying which game produced the data
2. THE Unified_Telemetry_Format SHALL include all fields currently consumed by the frontend: speed, rpm, gear, throttle, brake, clutch, steering, lap, lapDistPct, position, classPosition, lastLapTime, bestLapTime, currentLapTime, fuelLevel, fuelPercent, gLateral, gLongitudinal, tire temperatures, tire wear, flags, weather data, driver info, track info, and handling indicators
3. THE Unified_Telemetry_Format SHALL include a `fieldAvailability` object that maps each field name to a boolean indicating whether the current simulator provides that field natively
4. WHEN a field is not available from the source simulator, THE Unified_Telemetry_Format SHALL represent that field as Null_Value in the JSON output
5. THE Unified_Telemetry_Format SHALL preserve the existing `timestamp` and `connected` fields with identical semantics to the current iRacing implementation

### Requirement 3: iRacing Connector (Migration)

**User Story:** As an existing iRacing user, I want my current telemetry experience to remain identical after the refactor, so that the multi-sim architecture does not introduce regressions.

#### Acceptance Criteria

1. THE iRacing Connector SHALL read telemetry using the pyirsdk library at 10 Hz
2. THE iRacing Connector SHALL populate all fields in the Unified_Telemetry_Format that iRacing exposes (maintaining the same values as the current `iracing_live.py`)
3. WHEN iRacing is not running, THE iRacing Connector SHALL return a status payload with `connected: false` and `waiting: true`
4. THE iRacing Connector SHALL produce output byte-for-byte equivalent to the current `iracing_live.py` output for all fields that exist in the Unified_Telemetry_Format

### Requirement 4: F1 2024/2025 Connector

**User Story:** As an F1 2024/2025 player, I want to see my telemetry on the ApexVision dashboard, so that I can analyze my driving in EA/Codemasters F1 games.

#### Acceptance Criteria

1. THE F1_Connector SHALL receive UDP telemetry packets on port 20777 using the Codemasters/EA binary protocol
2. THE F1_Connector SHALL decode packet types: Motion, Session, Lap Data, Car Telemetry, Car Status, and Participants
3. THE F1_Connector SHALL map decoded fields to the Unified_Telemetry_Format including: speed, rpm, gear, throttle, brake, steering, tire temperatures, tire wear, fuel, ERS deployment, DRS status, weather, lap times, and position
4. WHEN the F1 game is not broadcasting UDP packets, THE F1_Connector SHALL report `connected: false` after a 3-second timeout with no received packets
5. THE F1_Connector SHALL support both F1 2024 and F1 2025 packet formats by detecting the packet format version from the header

### Requirement 5: Assetto Corsa Connector

**User Story:** As an Assetto Corsa player, I want to see my telemetry on the ApexVision dashboard, so that I can analyze my driving in AC.

#### Acceptance Criteria

1. THE AC_Connector SHALL read telemetry from Assetto Corsa's Shared_Memory interface on Windows
2. THE AC_Connector SHALL read the physics, graphics, and static info memory-mapped files (`acpmf_physics`, `acpmf_graphics`, `acpmf_static`)
3. THE AC_Connector SHALL map Assetto Corsa fields to the Unified_Telemetry_Format including: speed, rpm, gear, throttle, brake, steering, tire temperatures, tire wear (when available), fuel, g-forces, lap times, and position
4. WHEN Assetto Corsa is not running, THE AC_Connector SHALL detect an empty or stale Shared_Memory region and report `connected: false`
5. IF the Shared_Memory data has not been updated for more than 2 seconds, THEN THE AC_Connector SHALL consider the simulator disconnected

### Requirement 6: Assetto Corsa Competizione Connector

**User Story:** As an ACC player, I want to see my telemetry on the ApexVision dashboard, so that I can analyze my driving in ACC.

#### Acceptance Criteria

1. THE ACC_Connector SHALL read telemetry from ACC's Shared_Memory interface on Windows
2. THE ACC_Connector SHALL read the physics, graphics, and static info memory-mapped files specific to ACC (`Local\acpmf_physics`, `Local\acpmf_graphics`, `Local\acpmf_static` with ACC-specific struct layouts)
3. THE ACC_Connector SHALL map ACC fields to the Unified_Telemetry_Format including: speed, rpm, gear, throttle, brake, steering, tire temperatures, tire pressures, tire wear, fuel, g-forces, lap times, position, weather conditions, and track grip status
4. WHEN ACC is not running, THE ACC_Connector SHALL detect an empty or stale Shared_Memory region and report `connected: false`
5. THE ACC_Connector SHALL handle the ACC-specific struct layout independently from the AC1 struct layout, as the two games use incompatible memory structures

### Requirement 7: Connector Selection and Switching

**User Story:** As a user, I want to choose which simulator to connect to, so that I can use ApexVision with whichever game I am currently playing.

#### Acceptance Criteria

1. THE Telemetry_Server SHALL accept a `--simulator` command-line argument specifying which Connector to activate (values: "iracing", "f1", "ac", "acc")
2. THE Telemetry_Server SHALL default to "iracing" when no `--simulator` argument is provided
3. THE Connector_Registry SHALL map simulator identifiers to their Connector implementations and raise a clear error for unrecognized identifiers
4. WHEN the Telemetry_Server starts, THE Telemetry_Server SHALL log the selected simulator name and connection parameters to stdout
5. THE Telemetry_Server SHALL support an optional `--auto-detect` mode that attempts to connect to each registered Connector in sequence and activates the first one that succeeds

### Requirement 8: Session Recording Compatibility

**User Story:** As a user, I want session recording and S3 upload to work the same regardless of which simulator I'm using, so that I have consistent session history across all games.

#### Acceptance Criteria

1. THE Session_Recorder SHALL operate identically for all Connectors: writing JSONL telemetry samples, lap summaries, session info, and events
2. THE Session_Recorder SHALL include the `simulator` field in the `session_info.json` file to identify which game produced the recording
3. WHEN a Connector provides Null_Value fields, THE Session_Recorder SHALL write those null values to disk without filtering them out
4. THE Session_Recorder SHALL organize session folders using the existing naming convention: `<timestamp>_<driver>_<track>`
5. THE Session_Recorder SHALL upload completed sessions to S3 using the same logic regardless of the source simulator

### Requirement 9: Graceful Field Unavailability

**User Story:** As a frontend developer, I want fields that aren't available from a simulator to be clearly marked as null, so that the dashboard can display appropriate fallbacks instead of incorrect data.

#### Acceptance Criteria

1. WHEN the frontend receives a Null_Value for a telemetry field, THE Unified_Telemetry_Format documentation SHALL specify that the frontend should display "N/A" or hide the corresponding widget
2. THE Connector SHALL never fabricate or estimate values for fields the simulator does not provide
3. THE Unified_Telemetry_Format SHALL include a `fieldAvailability` mapping so the frontend can determine at connection time which fields will be populated for the active simulator
4. WHEN the `fieldAvailability` indicates a field is unavailable, THE Connector SHALL consistently return Null_Value for that field throughout the entire session

### Requirement 10: Telemetry Format Serialization (Round-Trip)

**User Story:** As a developer, I want to serialize and deserialize telemetry payloads reliably, so that recorded sessions can be replayed and analyzed without data loss.

#### Acceptance Criteria

1. THE Unified_Telemetry_Format serializer SHALL convert a telemetry dictionary to a JSON string
2. THE Unified_Telemetry_Format deserializer SHALL convert a JSON string back to a telemetry dictionary
3. FOR ALL valid telemetry dictionaries, serializing then deserializing SHALL produce an equivalent dictionary (round-trip property)
4. THE serializer SHALL handle Null_Value fields, numeric precision (floats rounded per field specification), and all supported data types (int, float, bool, string, list, null)
