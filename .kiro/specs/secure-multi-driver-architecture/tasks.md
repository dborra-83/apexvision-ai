# Implementation Plan: Secure Multi-Driver Architecture

## Overview

This plan implements the secure multi-driver WebSocket gateway architecture in dependency order: infrastructure first, then Lambda logic, then Python script changes, then frontend, and finally testing/cleanup.

## Task Dependency Graph

```json
{
  "waves": [
    ["1.1", "1.2", "1.3", "1.4"],
    ["1.5", "1.6", "1.7"],
    ["1.8", "1.9", "1.10"],
    ["2.1", "2.2", "2.3", "2.4", "2.5"],
    ["2.6", "3.1", "3.2", "3.3", "3.4", "3.5"],
    ["3.6", "4.1", "4.2", "4.3", "4.4", "4.5"],
    ["4.6", "5.1", "5.2", "5.3", "5.4"],
    ["5.5", "5.6", "5.7", "5.8", "5.9", "5.10"]
  ]
}
```

## Tasks

### Phase 1: Infrastructure (CDK)

- [ ] 1.1 Add Telemetry Frames DynamoDB table to `api-stack.ts`
  - Table: `apexvision-{stage}-telemetry-frames`
  - PK: `driverId` (String), SK: `timestamp` (Number)
  - TTL attribute: `ttl`
  - GSI: `session-index` (PK: `sessionId`, SK: `timestamp`)
  - Billing: PAY_PER_REQUEST
  - **Refs:** Req 4.1, 4.2, 4.5

- [ ] 1.2 Add `clientType-index` GSI to existing Connections table
  - PK: `clientType` (String), SK: `connectedAt` (Number)
  - Projection: ALL
  - **Refs:** Req 3.1, 5.1

- [ ] 1.3 Add `driverId-index` GSI to existing Connections table
  - PK: `driverId` (Number), SK: `connectedAt` (Number)
  - Projection: ALL
  - **Refs:** Req 3.5, 6.4

- [ ] 1.4 Create SSM Parameter Store SecureString for API key
  - Parameter: `/apexvision/api-key`
  - Type: SecureString (KMS-encrypted)
  - Placeholder value with instruction to rotate immediately
  - **Refs:** Req 2.3, 2.4, 10.2

- [ ] 1.5 Create `onConnect` Lambda function resource
  - Runtime: Node.js 20, Memory: 128 MB, Timeout: 10s
  - IAM: DynamoDB PutItem (connections), SSM GetParameter (with decrypt)
  - Environment variable: `CONNECTIONS_TABLE_NAME`, `API_KEY_PARAM_NAME`
  - **Refs:** Req 2.1, 2.2, 2.3, 3.1

- [ ] 1.6 Create `onTelemetry` Lambda function resource
  - Runtime: Node.js 20, Memory: 128 MB, Timeout: 10s
  - IAM: DynamoDB PutItem (telemetry), DynamoDB Query+Delete (connections), API Gateway ManageConnections
  - Environment variables: `TELEMETRY_TABLE_NAME`, `CONNECTIONS_TABLE_NAME`, `WS_ENDPOINT`
  - **Refs:** Req 4.1, 4.3, 5.1, 5.3

- [ ] 1.7 Create `onDisconnect` Lambda function resource
  - Runtime: Node.js 20, Memory: 128 MB, Timeout: 10s
  - IAM: DynamoDB DeleteItem (connections)
  - Environment variable: `CONNECTIONS_TABLE_NAME`
  - **Refs:** Req 3.2

- [ ] 1.8 Wire WebSocket API routes to Lambda integrations
  - `$connect` → onConnect Lambda (AWS_PROXY)
  - `telemetry` → onTelemetry Lambda (AWS_PROXY)
  - `$disconnect` → onDisconnect Lambda (AWS_PROXY)
  - Create deployment + `prod` stage
  - Configure route selection expression: `$request.body.action`
  - **Refs:** Req 1.1, 1.4, 5.5

- [ ] 1.9 Configure WebSocket API stage settings
  - Stage: `prod`
  - Throttling: 1000 burst, 500 steady
  - Logging: enabled
  - Max message payload: 32 KB (default)
  - **Refs:** Req 1.1, 5.5

- [ ] 1.10 Output WebSocket endpoint URL as CloudFormation output
  - Export: `{prefix}-ws-endpoint`
  - Format: `wss://{api-id}.execute-api.{region}.amazonaws.com/prod`
  - **Refs:** Req 1.1

### Phase 2: Lambda Function Implementation

- [ ] 2.1 Implement `onConnect` handler logic
  - Extract `apiKey`, `driverId`, `clientType` from query string
  - Fetch and cache API key from SSM (60s TTL in global scope)
  - Constant-time compare using `crypto.timingSafeEqual()`
  - Return 401 on mismatch, 400 on invalid driverId
  - Write connection record with 24h TTL to Connections table
  - **Refs:** Req 2.1, 2.2, 2.3, 2.5, 3.1, 3.3, 3.5

- [ ] 2.2 Implement `onTelemetry` handler logic
  - Parse body JSON, validate `driverId` is 1-4
  - Add `serverTimestamp` to record
  - PutItem to Telemetry table (PK: `DRIVER#{id}`, SK: timestamp)
  - Query Connections table `clientType-index` for frontends
  - PostToConnection for each frontend with broadcast payload
  - Handle GoneException: delete stale connection
  - Send error back to sender on invalid driverId
  - **Refs:** Req 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4

- [ ] 2.3 Implement `onDisconnect` handler logic
  - Extract `connectionId` from requestContext
  - DeleteItem from Connections table
  - **Refs:** Req 3.2

- [ ] 2.4 Implement driver status broadcast on connect/disconnect
  - In onConnect: after registration, broadcast `driverStatus` message to frontends
  - In onDisconnect: before deletion, broadcast disconnect status to frontends
  - Message format: `{ type: "driverStatus", driverId, status, serverTimestamp }`
  - **Refs:** Req 6.4

- [ ] 2.5 Add structured logging and error handling to all Lambdas
  - JSON-structured CloudWatch logs
  - Log: connectionId, driverId, action, duration, errors
  - Error categorization: auth failure, validation error, DDB error, broadcast error
  - **Refs:** Req 4.4 (independent processing)

- [ ] 2.6 Write unit tests for Lambda handlers
  - Test onConnect: valid key → 200, invalid key → 401, missing key → 401
  - Test onConnect: valid driverId → register, invalid → 400
  - Test onTelemetry: valid frame → store + broadcast, invalid driverId → error
  - Test onTelemetry: GoneException → stale cleanup
  - Test onDisconnect: removes record
  - Mock DynamoDB, SSM, API Gateway Management

### Phase 3: Python Script Update

- [ ] 3.1 Create new `telemetry_server.py` with WSS client architecture
  - Remove all `boto3` / AWS SDK dependencies
  - Add CLI arguments: `--driver`, `--gateway`, `--api-key`, `--sim`, `--rate`
  - Establish WSS connection with API key in query params
  - SSL/TLS validation with `ssl.create_default_context()`
  - **Refs:** Req 7.1, 7.2, 7.3, 7.6, 10.4, 10.5

- [ ] 3.2 Implement exponential backoff reconnection for gateway
  - Start at 1 second delay
  - Double on each failure, cap at 30 seconds
  - Reset to 1 second on successful connection
  - Log reconnection attempts and status
  - **Refs:** Req 7.4

- [ ] 3.3 Retain local WebSocket server on port 8765
  - Keep existing `websockets.serve()` on port 8765
  - Broadcast same telemetry to local clients AND gateway
  - Support concurrent local + gateway connections
  - **Refs:** Req 8.1, 8.2, 8.3

- [ ] 3.4 Implement telemetry frame formatting for gateway
  - Wrap telemetry in `{ "action": "telemetry", "driverId": N, "data": {...} }`
  - Send at configured sample rate (default 10 Hz)
  - Non-blocking: gateway connection failure does not block local broadcast
  - **Refs:** Req 7.2, 8.3

- [ ] 3.5 Add TLS handshake failure handling
  - If SSL handshake fails, log security warning
  - Refuse to send telemetry to gateway (continue local only)
  - Alert user in console output
  - **Refs:** Req 10.5

- [ ] 3.6 Update README / setup documentation for new script usage
  - Document CLI arguments
  - Example: `python telemetry_server.py --driver 2 --gateway wss://... --api-key ...`
  - Note: no AWS SDK required, no IAM credentials needed
  - **Refs:** Req 7.1, 7.6

### Phase 4: Frontend Changes

- [ ] 4.1 Create multi-driver Zustand store (`useTelemetryStore`)
  - State: `telemetryByDriver: Record<number, TelemetryFrame | null>`
  - State: `driverStatus: Record<number, { connected: boolean; lastSeen: number }>`
  - Action: `connect(gatewayUrl, apiKey)` — establish WSS as frontend client
  - Action: `handleMessage(msg)` — route by `type` field to update correct driver
  - Handle `telemetry` and `driverStatus` message types
  - **Refs:** Req 6.3, 6.4

- [ ] 4.2 Create `TeamView` page component at `/team` route
  - 2×2 CSS grid layout using Tailwind
  - `DriverPanel` component for each driver (1-4)
  - Display: speed, RPM, gear, lap, position, tire temps (mini dashboard)
  - Driver ID label on each panel
  - Connected/disconnected indicator (green/gray dot)
  - **Refs:** Req 6.1, 6.4, 6.5

- [ ] 4.3 Update `Live` page with driver selector dropdown
  - Add `<select>` dropdown showing drivers 1-4
  - Show connection status per driver in dropdown options
  - Filter displayed telemetry by selected driverId
  - Switch within 200ms (client-side state change, no network)
  - **Refs:** Req 6.2, 6.3

- [ ] 4.4 Update `App.tsx` router with `/team` route
  - Import Team component
  - Add protected route: `/team` → `<Team />`
  - Add navigation link in layout/sidebar
  - **Refs:** Req 6.1

- [ ] 4.5 Implement WebSocket connection management in frontend
  - Connect on app mount (or on first protected route)
  - URL: `wss://{gateway}?apiKey={key}&clientType=frontend`
  - Auto-reconnect with exponential backoff
  - Connection status indicator in UI header
  - **Refs:** Req 1.3, 6.4

- [ ] 4.6 Write component tests for Team and Live views
  - Test TeamView renders 4 driver panels
  - Test driver availability indicator updates
  - Test Live dropdown switches telemetry source
  - Test WebSocket message routing to correct driver state

### Phase 5: Testing & Cleanup

- [ ] 5.1 Deploy CDK stack to dev environment and verify
  - `cdk deploy` all stacks
  - Verify WebSocket API endpoint is accessible
  - Verify DynamoDB tables created with correct schemas
  - Verify SSM parameter exists
  - **Refs:** Req 1.1

- [ ] 5.2 Integration test: PC → Gateway → DynamoDB → Frontend
  - Connect with valid API key from test script
  - Send telemetry frame
  - Verify frame stored in Telemetry table
  - Verify broadcast received by connected frontend
  - **Refs:** Req 4.1, 5.1

- [ ] 5.3 Integration test: Authentication rejection
  - Connect with invalid API key → verify 401 returned
  - Connect with missing API key → verify 401 returned
  - Connect with invalid driverId → verify 400 returned
  - **Refs:** Req 2.1, 2.2

- [ ] 5.4 Integration test: Connection lifecycle
  - Connect → verify record in Connections table
  - Disconnect → verify record removed
  - Verify TTL is set to 24 hours from connect time
  - **Refs:** Req 3.1, 3.2, 3.3

- [ ] 5.5 Load test: 4 simultaneous drivers at 10 Hz
  - Run 4 concurrent WebSocket connections sending at 10 Hz
  - Verify all frames stored (40 frames/sec total)
  - Verify broadcast latency < 100ms
  - Verify no frame loss or ordering issues
  - **Refs:** Req 4.3, 5.4

- [ ] 5.6 Test API key rotation
  - Update SSM parameter value
  - Wait 60 seconds
  - Connect with new key → verify success
  - Connect with old key → verify rejection
  - **Refs:** Req 2.5

- [ ] 5.7 Test LAN fallback mode
  - Run telemetry_server.py without gateway connectivity
  - Verify local WebSocket on port 8765 still serves telemetry
  - Verify gateway reconnection attempts with backoff
  - **Refs:** Req 7.4, 7.5, 8.1

- [ ] 5.8 Remove legacy DynamoDB/S3 direct-write code from Python script
  - Remove `boto3` imports and usage from `iracing_live.py`
  - Remove `init_dynamo()`, `_dynamo_save_sample()`, `_dynamo_save_lap_summary()`
  - Remove `upload_to_s3()` function
  - Keep local file logging (sessions directory)
  - **Refs:** Req 7.6

- [ ] 5.9 Update architecture documentation
  - Update `docs/architecture/apexvision-architecture.md` with final deployment details
  - Add data flow diagram for new gateway path
  - Include security model diagram
  - Include cost estimation validation
  - **Refs:** Req 9.1, 9.2, 9.3, 9.4, 9.5, 9.6

- [ ] 5.10 Create `IRACING_SETUP.md` update with new connection instructions
  - Document simplified setup: only URL + API key needed
  - Remove AWS credential configuration steps
  - Add troubleshooting for WSS connection issues
  - **Refs:** Req 7.1, 7.6

## Notes

- All Lambda functions use Node.js 20 runtime, 128 MB memory, 10s timeout
- DynamoDB tables use PAY_PER_REQUEST billing (on-demand)
- The Python script retains local file logging (sessions directory) even after removing boto3
- Frontend WebSocket connection uses the same gateway endpoint as simulators, distinguished by `clientType=frontend`
- API key rotation requires no code deployment — SSM update propagates within 60s via Lambda cache TTL
