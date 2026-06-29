# ApexVision AI — Architecture Document

## Executive Summary

ApexVision AI is a real-time racing telemetry platform that provides AI-powered race engineering capabilities for sim racing teams. The platform ingests telemetry from up to 4 simultaneous racing simulators, processes it in real-time, stores it for post-session analysis, and delivers intelligent recommendations through an AI Race Engineer.

**Supported Simulators:** iRacing, F1 2024/2025, Assetto Corsa, Assetto Corsa Competizione

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SIMULATOR PCs (1-4)                           │
│                                                                     │
│  [PC 1: iRacing]  [PC 2: ACC]  [PC 3: F1 2025]  [PC 4: AC]       │
│       │                │              │               │             │
│  telemetry.py     telemetry.py   telemetry.py    telemetry.py      │
│  --driver 1       --driver 2     --driver 3      --driver 4        │
│       │                │              │               │             │
│       └────────────────┴──────────────┴───────────────┘             │
│                           │ WSS + API Key                           │
└───────────────────────────┼─────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         AWS CLOUD                                    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              API Gateway (WebSocket API)                      │   │
│  │              wss://xxx.execute-api.us-east-1.amazonaws.com    │   │
│  │                                                              │   │
│  │  Routes:                                                     │   │
│  │    $connect    → Lambda (auth + register)                    │   │
│  │    telemetry   → Lambda (store + broadcast)                  │   │
│  │    $disconnect → Lambda (cleanup)                            │   │
│  └──────────┬────────────────────────────┬──────────────────────┘   │
│             │                            │                          │
│             ▼                            ▼                          │
│  ┌──────────────────┐        ┌──────────────────────┐              │
│  │  Lambda Functions │        │   DynamoDB Tables     │              │
│  │                   │        │                      │              │
│  │  • onConnect      │───────►│  • connections       │              │
│  │  • onTelemetry    │───────►│  • telemetry-frames  │              │
│  │  • onDisconnect   │        │  • lap-summaries     │              │
│  │  • aiAnalyzer     │        │                      │              │
│  └───────────────────┘        └──────────────────────┘              │
│             │                                                       │
│             │ broadcast                                              │
│             ▼                                                       │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │           Connected Frontend Clients                       │      │
│  │           (via same WebSocket API)                         │      │
│  └──────────────────────────────────────────────────────────┘      │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐    │
│  │  CloudFront (CDN) │  │   S3 (Sessions)   │  │  SSM Param    │    │
│  │  Frontend hosting │  │   Telemetry logs  │  │  Store (Keys) │    │
│  └──────────────────┘  └──────────────────┘  └───────────────┘    │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐                       │
│  │  Cognito          │  │  Amazon Bedrock   │                       │
│  │  User auth        │  │  AI Race Engineer │                       │
│  └──────────────────┘  └──────────────────┘                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Real-Time Telemetry (10 Hz per driver)

```
1. Simulator PC reads telemetry from game (shared memory / UDP / SDK)
2. Python script formats data as UnifiedTelemetry JSON
3. Script sends frame via WSS to API Gateway with driverId + API key
4. API Gateway routes to Lambda (onTelemetry)
5. Lambda writes frame to DynamoDB (telemetry-frames table)
6. Lambda broadcasts frame to all connected frontend subscribers
7. Frontend renders telemetry in real-time dashboard
```

### Session Recording & Analysis

```
1. Lambda detects lap changes from telemetry stream
2. Lap summary calculated and stored in DynamoDB (lap-summaries table)
3. On session end, Lambda aggregates session data to S3 (JSON)
4. Frontend Analysis page reads from DynamoDB/S3 for post-session review
5. AI analyzer (Bedrock) processes session data for insights
```

---

## AWS Services Used

| Service | Purpose | Justification |
|---------|---------|---------------|
| **API Gateway (WebSocket)** | Central WSS endpoint for all telemetry traffic | Managed WebSocket with built-in auth, scaling, no servers to manage |
| **Lambda** | Process telemetry frames, auth, broadcast | Serverless, pay-per-invocation, scales to 0 when idle |
| **DynamoDB** | Store telemetry frames + session data | Sub-millisecond latency, auto-scales, TTL for data lifecycle |
| **S3** | Session recordings, frontend hosting | Durable storage, low cost for historical data |
| **CloudFront** | Frontend CDN | Global low-latency delivery, HTTPS |
| **Cognito** | User authentication (frontend) | Managed auth with MFA, no custom auth server |
| **SSM Parameter Store** | API key storage | Encrypted (KMS), no hardcoded secrets, rotatable |
| **Amazon Bedrock** | AI Race Engineer recommendations | Managed GenAI, no model hosting, pay-per-token |
| **CloudWatch** | Monitoring and logging | Unified observability for all Lambda functions |

---

## Security Model

### Authentication Layers

1. **Simulator PCs → Gateway**: API Key (stored in SSM Parameter Store, transmitted only on $connect)
2. **Frontend → Gateway**: Same API Key (for WebSocket subscription)
3. **Frontend → App**: AWS Cognito (user login with MFA)
4. **Lambda → DynamoDB/S3**: IAM Role permissions (no credentials in code)

### Encryption

| Layer | Method |
|-------|--------|
| PC ↔ API Gateway | TLS 1.2+ (WSS) |
| Frontend ↔ CloudFront | TLS 1.2+ (HTTPS) |
| API Key at rest | KMS-encrypted (SSM SecureString) |
| DynamoDB at rest | AWS-owned key encryption |
| S3 at rest | SSE-S3 |

### Zero-Credential PC Design

- **No AWS SDK** required on simulator PCs
- **No IAM keys** distributed to team members
- **Only 2 values** needed per PC: WSS URL + API Key
- API Key rotatable without PC restart (60-second propagation)

---

## Cost Estimation (Demo Environment)

**Assumptions:** 4 drivers, 10 Hz telemetry, 4-hour sessions, 3 sessions/week

| Service | Monthly Usage | Estimated Cost |
|---------|--------------|---------------|
| API Gateway (WebSocket) | ~17M messages/month | ~$17 |
| Lambda (onTelemetry) | ~17M invocations (128MB, 50ms avg) | ~$4 |
| DynamoDB (writes) | ~17M WCU/month | ~$8 |
| DynamoDB (reads) | ~2M RCU/month (analysis) | ~$1 |
| S3 (session storage) | ~5 GB/month | ~$0.15 |
| CloudFront | ~50 GB transfer | ~$4 |
| Cognito | <50 MAU | Free tier |
| SSM Parameter Store | <10 params | Free tier |
| **TOTAL** | | **~$35/month** |

*Note: With DynamoDB TTL (30-day retention), storage costs are bounded.*

---

## Scalability Considerations

| Dimension | Current | Scalable To | How |
|-----------|---------|-------------|-----|
| Drivers | 4 | 100+ | API Gateway auto-scales, DynamoDB on-demand |
| Sample rate | 10 Hz | 60 Hz | Lambda concurrency increase |
| Teams | 1 | Multiple | API Key per team, partition data by teamId |
| Viewers | 4 | 1000+ | API Gateway handles fan-out, add SQS buffer if needed |
| Simulators | 4 types | Any | Connector plugin architecture |
| Data retention | 30 days | Years | S3 lifecycle + Glacier |

---

## Network Topology

```
[Internet]
    │
    ├── CloudFront (d9rzcopje8wn2.cloudfront.net) → S3 (frontend)
    │
    ├── API Gateway WSS (wss://xxx.execute-api.us-east-1.amazonaws.com/prod)
    │       ├── Sim PCs connect (send telemetry)
    │       └── Frontends connect (receive telemetry)
    │
    └── [LAN Fallback]
            └── Sim PC port 8765 (direct WS for zero-latency local access)
```

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Simulator connectors | Python 3.11+, websockets library |
| Backend (serverless) | AWS Lambda (Node.js 20 or Python 3.12) |
| Infrastructure as Code | AWS CDK (TypeScript) |
| Frontend | React 18, TypeScript, Vite, TailwindCSS |
| State management | Zustand |
| Real-time comms | WebSocket (API Gateway managed) |
| AI/ML | Amazon Bedrock (Claude/Titan) |
| Monitoring | CloudWatch Logs + Metrics |

---

## Deployment Model

- **Infrastructure**: CDK deploy from CI/CD (GitHub Actions)
- **Frontend**: S3 + CloudFront (auto-deploy on push to main)
- **Simulator scripts**: Manual copy to PCs (or git pull)
- **Environments**: Dev (current) → Staging → Production

---

*Document Version: 1.0*  
*Last Updated: June 2026*  
*Author: ApexVision AI Team — CloudHesive*
