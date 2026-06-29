# Requirements Document

## Introduction

This feature centralizes and secures the ApexVision AI telemetry pipeline by replacing direct AWS credential usage on simulator PCs with a single API Gateway WebSocket (WSS) endpoint. Four simultaneous simulator PCs send telemetry through the gateway using API key authentication, while Lambda functions handle storage and broadcast. The architecture eliminates boto3 and AWS credentials from PC scripts, resolves mixed-content browser issues, and produces a professional reference architecture document suitable for AWS presentation.

## Glossary

- **Gateway**: The AWS API Gateway WebSocket (WSS) endpoint that serves as the single entry point for all telemetry connections
- **Simulator_PC**: A Windows PC running a racing simulator (iRacing, F1 2024/25, Assetto Corsa, or ACC) and the local telemetry script
- **Telemetry_Script**: The simplified Python script on each Simulator_PC that reads local sim data and sends it to the Gateway
- **Frontend**: The React web application served via CloudFront that displays live telemetry and analysis
- **Lambda_OnConnect**: The Lambda function triggered when a client connects to the Gateway
- **Lambda_OnTelemetry**: The Lambda function triggered when a telemetry frame is received at the Gateway
- **Lambda_OnDisconnect**: The Lambda function triggered when a client disconnects from the Gateway
- **Connections_Table**: The DynamoDB table storing active WebSocket connection metadata
- **Telemetry_Table**: The DynamoDB table storing telemetry frames for persistence and analysis
- **API_Key**: A team-level secret token used to authenticate Simulator_PCs and Frontends against the Gateway
- **Driver_ID**: A numeric identifier (1 through 4) uniquely identifying each Simulator_PC within a team session
- **Telemetry_Frame**: A single JSON payload containing one sample of simulator telemetry data
- **Subscriber**: A connected Frontend client registered to receive live telemetry broadcasts
- **LAN_Fallback**: The local WebSocket server on port 8765 retained for direct LAN connectivity when the Gateway is unavailable

## Requirements

### Requirement 1: Secure Gateway Endpoint

**User Story:** As a team administrator, I want a single secure WebSocket endpoint for all telemetry traffic, so that no AWS credentials are needed on simulator PCs.

#### Acceptance Criteria

1. THE Gateway SHALL provide a WSS (WebSocket Secure) endpoint accessible over TLS 1.2 or higher
2. WHEN a Simulator_PC initiates a connection, THE Gateway SHALL require an API_Key in the connection query string parameters
3. WHEN a Frontend initiates a connection, THE Gateway SHALL require an API_Key in the connection query string parameters
4. THE Gateway SHALL support a minimum of 8 concurrent WebSocket connections (4 Simulator_PCs plus 4 Frontends)
5. WHILE the Gateway is operational, THE Gateway SHALL accept connections from any network without IP restrictions

### Requirement 2: API Key Authentication

**User Story:** As a team administrator, I want simple API key authentication per team, so that I can secure access without distributing AWS credentials.

#### Acceptance Criteria

1. WHEN a connection request includes a valid API_Key, THE Lambda_OnConnect SHALL return a 200 status code and register the connection
2. WHEN a connection request includes an invalid or missing API_Key, THE Lambda_OnConnect SHALL return a 401 status code and reject the connection
3. THE Lambda_OnConnect SHALL validate the API_Key against a stored value in AWS Systems Manager Parameter Store
4. THE API_Key SHALL be a minimum of 32 characters in length
5. WHEN the API_Key is rotated in Parameter Store, THE Gateway SHALL accept the new key within 60 seconds without redeployment

### Requirement 3: Connection Lifecycle Management

**User Story:** As a platform operator, I want connection registration and cleanup handled automatically, so that the system tracks active clients accurately.

#### Acceptance Criteria

1. WHEN a client connects successfully, THE Lambda_OnConnect SHALL store the connection ID, client type (simulator or frontend), Driver_ID (if applicable), and timestamp in the Connections_Table
2. WHEN a client disconnects, THE Lambda_OnDisconnect SHALL remove the connection record from the Connections_Table
3. THE Lambda_OnConnect SHALL set a TTL of 24 hours on each connection record in the Connections_Table
4. IF a connection record exceeds the TTL without renewal, THEN THE Connections_Table SHALL automatically delete the stale record
5. WHEN a Simulator_PC connects, THE Lambda_OnConnect SHALL register the provided Driver_ID (1 through 4) with the connection record

### Requirement 4: Telemetry Ingestion and Storage

**User Story:** As a race engineer, I want telemetry frames stored centrally in DynamoDB, so that I can analyze session data without accessing individual PCs.

#### Acceptance Criteria

1. WHEN a Telemetry_Frame is received from a Simulator_PC, THE Lambda_OnTelemetry SHALL write the frame to the Telemetry_Table with the Driver_ID as part of the partition key
2. WHEN a Telemetry_Frame is received, THE Lambda_OnTelemetry SHALL add a server-side timestamp to the stored record
3. THE Lambda_OnTelemetry SHALL process each Telemetry_Frame within 100 milliseconds of receipt
4. WHEN a Telemetry_Frame contains an unrecognized Driver_ID (outside 1 through 4), THE Lambda_OnTelemetry SHALL reject the frame and return an error to the sender
5. THE Telemetry_Table SHALL use a composite key of Driver_ID (partition) and timestamp (sort) for efficient per-driver queries

### Requirement 5: Live Telemetry Broadcast

**User Story:** As a frontend viewer, I want to receive live telemetry from all connected drivers, so that I can monitor the team in real time.

#### Acceptance Criteria

1. WHEN a Telemetry_Frame is received and stored, THE Lambda_OnTelemetry SHALL broadcast the frame to all connected Subscribers
2. THE Lambda_OnTelemetry SHALL include the Driver_ID in every broadcast message so Subscribers can identify the source driver
3. IF a broadcast to a Subscriber fails due to a stale connection, THEN THE Lambda_OnTelemetry SHALL remove the stale connection from the Connections_Table
4. WHEN multiple Simulator_PCs send frames concurrently, THE Lambda_OnTelemetry SHALL process and broadcast each frame independently without blocking
5. THE Gateway SHALL support a message payload size of at least 32 KB per Telemetry_Frame

### Requirement 6: Multi-Driver Frontend Views

**User Story:** As a race engineer, I want to view all 4 drivers simultaneously or focus on a single driver, so that I can monitor individual and team performance.

#### Acceptance Criteria

1. THE Frontend SHALL provide a team view at the `/team` route displaying telemetry from all connected drivers simultaneously
2. THE Frontend SHALL provide a live view at the `/live` route displaying telemetry from a single selected driver
3. WHEN a driver selection is changed on the `/live` view, THE Frontend SHALL switch the displayed telemetry within 200 milliseconds
4. WHEN a Simulator_PC connects or disconnects, THE Frontend SHALL update the driver availability indicator within 2 seconds
5. THE Frontend SHALL display a Driver_ID label (1 through 4) alongside each driver telemetry panel in the team view

### Requirement 7: Simplified PC Telemetry Script

**User Story:** As a team technician, I want the PC script to only read telemetry and send it over WSS, so that setup is simple and requires no AWS knowledge.

#### Acceptance Criteria

1. THE Telemetry_Script SHALL connect to the Gateway using only a WSS URL and an API_Key (no AWS SDK or credentials required)
2. THE Telemetry_Script SHALL read telemetry from the local simulator connector and send frames to the Gateway at the configured sample rate
3. THE Telemetry_Script SHALL identify itself with a Driver_ID in the connection parameters
4. IF the Gateway connection is lost, THEN THE Telemetry_Script SHALL attempt reconnection with exponential backoff starting at 1 second and capping at 30 seconds
5. WHILE the Gateway connection is unavailable, THE Telemetry_Script SHALL continue serving telemetry on the local WebSocket (port 8765) as LAN_Fallback
6. THE Telemetry_Script SHALL have no dependency on boto3 or any AWS SDK library

### Requirement 8: LAN Fallback Compatibility

**User Story:** As a team technician, I want local WebSocket access preserved, so that LAN-connected clients can still receive telemetry when the cloud connection is unavailable.

#### Acceptance Criteria

1. WHILE the Telemetry_Script is running, THE Telemetry_Script SHALL serve telemetry on a local WebSocket at port 8765 regardless of Gateway connectivity
2. WHEN a local client connects to port 8765, THE Telemetry_Script SHALL broadcast the same telemetry data sent to the Gateway
3. THE Telemetry_Script SHALL support concurrent connections from the Gateway and local WebSocket clients without performance degradation

### Requirement 9: Architecture Documentation

**User Story:** As a team lead, I want a professional architecture document, so that I can present the system design to AWS representatives.

#### Acceptance Criteria

1. THE Architecture_Document SHALL include a system diagram showing all AWS services and client connections
2. THE Architecture_Document SHALL include a data flow diagram showing the path from simulator to frontend
3. THE Architecture_Document SHALL list all AWS services used with justification for each service choice
4. THE Architecture_Document SHALL describe the security model including authentication method, encryption in transit, and zero-credential PC design
5. THE Architecture_Document SHALL include a monthly cost estimation for the demo environment (4 PCs, 10 Hz telemetry, 4 hours per session)
6. THE Architecture_Document SHALL include scalability considerations describing how the architecture supports additional drivers or teams

### Requirement 10: Security and Encryption

**User Story:** As a security-conscious operator, I want all telemetry data encrypted in transit and API keys stored securely, so that the platform meets professional security standards.

#### Acceptance Criteria

1. THE Gateway SHALL encrypt all WebSocket communication using TLS 1.2 or higher
2. THE API_Key SHALL be stored in AWS Systems Manager Parameter Store as a SecureString (encrypted with KMS)
3. THE Lambda_OnConnect SHALL retrieve the API_Key from Parameter Store using IAM role permissions (not hardcoded values)
4. THE Telemetry_Script SHALL transmit the API_Key only during the initial connection handshake (not in subsequent message payloads)
5. IF the TLS handshake fails, THEN THE Telemetry_Script SHALL refuse to send telemetry and log a security warning
