# Modelo de Permisos IAM - ApexVision AI

## Principios

- **Least-privilege**: Cada servicio/Lambda tiene permisos mínimos necesarios.
- **Sin wildcards en producción**: Ni en Action ni en Resource para statements Allow.
- **Validación automatizada**: cdk-nag + iam-validator en pipeline CI/CD.
- **Rotación de secretos**: Cada 90 días vía AWS Secrets Manager.

## Roles de Usuario (Cognito)

| Rol | Permisos |
|-----|----------|
| admin | Todo: dashboard, métricas (real-time + históricas), estrategia, alertas, reportes, usuarios, config |
| ingeniero_pista | dashboard, métricas real-time, estrategia, alertas (read + acknowledge) |
| analista | dashboard, métricas históricas, reportes (generar + exportar) |
| viewer | dashboard (solo lectura) |

## Políticas IAM por Servicio

### Lambda: Frame Extractor
- `kinesis:PutRecord` en stream de frames
- `s3:PutObject` en bucket de datos (prefijo `raw-frames/`)

### Lambda: Vision Orchestrator
- `sagemaker:InvokeEndpoint` en endpoint CV específico
- `kinesis:GetRecords` en stream de frames

### Lambda: Metrics Calculator
- `dynamodb:PutItem` en tabla de métricas
- `timestream:WriteRecords` en tabla metrics
- `events:PutEvents` en bus de alertas

### Lambda: API Handlers
- `dynamodb:GetItem, Query` en tablas de métricas y sesiones
- `execute-api:ManageConnections` en WebSocket API

### Lambda: GenAI Handler
- `bedrock:InvokeModel` en modelo Claude/Titan
- `bedrock:Retrieve` en Knowledge Base

## Cifrado (KMS)

- CMK compartida con rotación anual automática
- Servicios autorizados: S3, DynamoDB, Timestream, Kinesis, OpenSearch
- Key policy: solo roles de servicio específicos pueden usar la clave
