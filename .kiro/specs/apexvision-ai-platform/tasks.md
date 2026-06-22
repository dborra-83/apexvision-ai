# Implementation Plan

## Overview

Plan de implementación para ApexVision AI Platform — plataforma de análisis de rendimiento de F1 en tiempo real construida 100% sobre AWS. El plan se divide en 19 tareas incrementales que cubren: setup del monorepo, infraestructura CDK, autenticación, almacenamiento, ingesta, visión por computadora, métricas, IA generativa, predicción, alertas, API, dashboard, seguridad, observabilidad, hosting, CI/CD, datos de ejemplo, documentación y tests end-to-end.

## Tasks

- [x] 1. Inicializar estructura del monorepo y configuración base
  - Crear estructura de carpetas: infrastructure/ (CDK), backend/ (Lambdas), frontend/ (React SPA), ml-models/, docs/, .github/workflows/
  - Crear package.json raíz con workspaces (infrastructure, backend, frontend)
  - Crear tsconfig.base.json compartido (strict, ES2022)
  - Crear .gitignore, .nvmrc (Node 20 LTS)
  - Crear README.md profesional con descripción, arquitectura, prerequisitos, setup, despliegue
  - Crear turbo.json para monorepo tooling

- [x] 2. Configurar proyecto CDK base con stacks modulares
  - Inicializar proyecto CDK en infrastructure/ con TypeScript
  - Instalar dependencias: aws-cdk-lib, constructs, cdk-nag
  - Crear bin/apexvision.ts con configuración de ambientes (dev, staging, prod)
  - Crear stacks base: networking, auth, storage, ingestion, vision, api, frontend, observability
  - Configurar cdk.json con contexts por ambiente (account, region, feature flags)
  - Agregar cdk-nag aspect para validaciones de seguridad automáticas
  - Crear test de síntesis que valide que todos los stacks sintetizan sin error

- [x] 3. Implementar stack de autenticación con Cognito
  - Crear cognito-construct.ts: User Pool con password policy (12+ chars), MFA obligatorio para admin/ingeniero_pista
  - Configurar User Pool Client: access token 15min, refresh token 24h, OAuth2 Authorization Code
  - Crear grupos Cognito: admin, ingeniero_pista, analista, viewer
  - Crear Identity Pool con roles IAM mapeados por grupo
  - Crear políticas IAM least-privilege por rol (4 policies según matriz PERMISOS_POR_ROL)
  - Crear backend/src/auth/rbac-authorizer.ts: Lambda authorizer que valida JWT y verifica permisos
  - Crear backend/src/auth/rate-limiter.ts: bloqueo 5 fallos/10min→30min, 3 fallos MFA→15min
  - Crear tests unitarios y property tests (Property 12: RBAC, Property 13: Rate limiting)

- [x] 4. Implementar stack de almacenamiento (DynamoDB, Timestream, S3, OpenSearch)
  - Crear tabla DynamoDB apexvision-metrics-realtime: PK=PILOT#{pilotoId}, SK=FRAME#{timestamp}#{frameId}, GSI sessionId-timestamp, TTL 24h, cifrado CMK
  - Crear tabla DynamoDB apexvision-sessions: PK=SESSION#{sessionId}, SK=META|PILOT#{pilotoId}
  - Crear Timestream database apexvision-telemetry, tabla metrics: retención memoria 24h, magnético 365-2555 días, cifrado CMK
  - Crear S3 bucket apexvision-data-{env}: lifecycle (30d→Intelligent-Tiering, 90d→Glacier), SSE-KMS, versionado, block public access
  - Crear OpenSearch Serverless colección apexvision-analytics: Search + Vector (1536 dims), cifrado CMK
  - Crear KMS CMK con rotación automática anual
  - Crear tests CDK assertions para validar recursos

- [x] 5. Implementar sistema de ingesta de video (Kinesis Video Streams + Data Streams)
  - Crear 20 Kinesis Video Streams (uno por piloto), retención 24h
  - Crear Kinesis Data Stream: shards para 600 records/s (20×30fps), cifrado CMK, enhanced monitoring
  - Crear backend/src/ingestion/frame-extractor.ts: Lambda que extrae frames de KVS, almacena en S3, publica FrameMessage en KDS (< 200ms)
  - Crear backend/src/ingestion/reconnection.ts: backoff exponencial base=1s, factor=2, max 3 intentos, transición a inactivo
  - Crear backend/src/ingestion/stream-monitor.ts: monitoriza pérdida frames, alarma si > 0.1% en 60s
  - Crear tests unitarios y property test (Property 1: backoff exponencial + estado inactivo)

- [x] 6. Implementar sistema de visión por computadora (SageMaker + Lambda orquestador)
  - Crear SageMaker endpoint: YOLO v8 + segmentación, auto-scaling min=2 max=10 ml.g5.xlarge, escala al 70%
  - Crear ECS Fargate GPU task definition como respaldo (Spot para costos)
  - Crear backend/src/vision/orchestrator.ts: invoca SageMaker con timeout 500ms, fallback a ECS
  - Crear backend/src/vision/confidence-filter.ts: filtra detecciones < 0.80
  - Crear backend/src/vision/discard-monitor.ts: cuenta descartes consecutivos, alerta si > 10
  - Crear backend/src/vision/inference-result.ts: tipos Detection, BoundingBox, SegmentationMask
  - Crear tests unitarios y property tests (Property 2: filtrado, Property 3: estructura, Property 4: alerta degradación)

- [x] 7. Implementar sistema de extracción de métricas
  - Crear backend/src/metrics/calculator.ts: calcula 5 métricas (velocidad, posición, frenado, ángulo, desgaste) con precisiones definidas
  - Crear backend/src/metrics/line-deviation.ts: transformación homográfica, interpolación punto cercano en línea óptima, distancia perpendicular
  - Crear backend/src/metrics/range-validator.ts: valida rangos físicos por circuito, marca anómalos, excluye de promedios
  - Crear backend/src/metrics/dynamodb-writer.ts: escritura al esquema definido con trazabilidad (frameId + timestamp)
  - Crear backend/src/metrics/timestream-writer.ts: escritura con retry 3 intentos/5s, DLQ si fallo
  - Crear backend/src/metrics/event-publisher.ts: publica evento metrica_calculada en EventBridge
  - Crear tests unitarios y property tests (Property 5: precisión, Property 6: desviación línea, Property 7: validación rangos)

- [x] 8. Implementar sistema de IA Generativa (Amazon Bedrock)
  - Crear bedrock-construct.ts: Knowledge Base con S3 datasource (reglas F1, históricos), Titan Embeddings v2, vector store en OpenSearch
  - Crear backend/src/genai/insight-handler.ts: genera insight cada 5s por piloto vía Bedrock (timeout 5s)
  - Crear backend/src/genai/strategy-handler.ts: recomendación estratégica para ventanas de adelantamiento (timeout 2s)
  - Crear backend/src/genai/summary-handler.ts: resumen de stint/sesión bajo demanda (timeout 10s)
  - Crear backend/src/genai/prompt-templates/: templates parametrizados por tipo de insight
  - Crear backend/src/genai/retry-handler.ts: max 3 reintentos, preservar último insight válido, notificar si fallo persistente
  - Crear tests unitarios con mock de Bedrock

- [x] 9. Implementar sistema de predicción (SageMaker ML)
  - Crear SageMaker endpoints: DeepAR (series temporales) + clasificación (anomalías), auto-scaling
  - Crear backend/src/prediction/pit-stop-predictor.ts: ejecuta cada 30s, produce ventana de vueltas con confianza
  - Crear backend/src/prediction/anomaly-detector.ts: Z-score sobre 10 vueltas, umbral > 2σ, clasifica (subviraje, sobreviraje, fatiga, degradación)
  - Crear backend/src/prediction/overtaking-windows.ts: cada 15s, umbral ≥ 0.3s diferencia por sector
  - Crear backend/src/prediction/confidence-reducer.ts: reduce confianza < 0.5 si frames procesados < 70%
  - Crear tests unitarios y property tests (Property 8: Z-score, Property 9: ventanas, Property 10: confianza)

- [x] 10. Implementar sistema de alertas (EventBridge)
  - Crear eventbridge-construct.ts: event bus custom, reglas por tipo, targets Lambda/SNS, DLQ
  - Crear backend/src/alerts/severity-classifier.ts: asigna severidad (critica/alta/media/informativa), pit stop < 3 vueltas = alta
  - Crear backend/src/alerts/alert-grouper.ts: agrupa > 10 alertas mismo tipo/piloto en 60s en evento consolidado
  - Crear backend/src/alerts/delivery-handler.ts: entrega vía WebSocket, retry 3×2s, escala a Admin si falla
  - Crear backend/src/alerts/audio-notifier.ts: flag audible para critica/alta
  - Crear tests unitarios y property tests (Property 14: severidad+SLA, Property 15: agrupación)

- [x] 11. Implementar capa de API (API Gateway REST + WebSocket)
  - Crear API Gateway REST: stages, Lambda authorizer, throttling 2000/min/IP, CORS, endpoints CRUD
  - Crear API Gateway WebSocket: routes $connect/$disconnect/$default/subscribe/unsubscribe, authorizer en $connect
  - Crear backend/src/api/websocket-connect.ts: valida auth, registra conexión en DDB
  - Crear backend/src/api/websocket-disconnect.ts: elimina conexión
  - Crear backend/src/api/websocket-broadcaster.ts: envía mensajes a clientes suscritos, limpia conexiones stale
  - Crear backend/src/api/metrics-handler.ts: consulta métricas DynamoDB + Timestream
  - Crear backend/src/api/predictions-handler.ts y sessions-handler.ts
  - Crear tests unitarios e integración WebSocket

- [x] 12. Implementar dashboard frontend (React SPA)
  - Inicializar React + Vite + TypeScript en frontend/, instalar dependencias (Amplify UI, recharts, zustand, tailwindcss)
  - Crear hooks: useAuth (Cognito), useWebSocket (reconexión auto max 5 intentos, detección datos obsoletos > 10s)
  - Crear componentes: Dashboard (grid responsive ≥ 1024px), PilotCard (5 métricas + indicador obsoleto), AlertNotification (fija top, alto contraste, audible, descarte manual)
  - Crear InsightPanel (texto + riesgo + contexto), ConnectionStatus (conectado/reconectando/perdido + botón manual)
  - Crear stores Zustand para métricas, alertas, predicciones, insights
  - Crear páginas: Login (MFA con Amplify Authenticator), Dashboard (layout responsive)
  - Configurar rutas protegidas por rol
  - Crear tests de componentes básicos

- [x] 13. Implementar seguridad (WAF, KMS, Secrets Manager, IAM validation)
  - Crear WAF WebACL: reglas OWASP Top 10, rate limit 2000/min/IP, logging CloudWatch
  - Crear Secrets Manager con rotación automática 90 días, cifrado CMK
  - Crear backend/src/security/iam-validator.ts: parsea políticas IAM, detecta wildcards en Action/Resource
  - Crear backend/src/security/ip-blocker.ts: bloqueo IP tras 3 fallos/5min por 15min, registro auditoría, notifica Admin
  - Configurar TLS 1.2 mínimo en todos los endpoints (rechazar versiones inferiores)
  - Crear tests unitarios y property tests (Property 16: wildcards IAM, Property 17: bloqueo IP)

- [x] 14. Implementar observabilidad (CloudWatch, X-Ray, alarmas)
  - Crear observability-construct.ts: log groups 30 días, X-Ray tracing, dashboard CloudWatch, tema SNS operaciones
  - Crear backend/src/observability/log-formatter.ts: JSON con timestamp/nivel/servicio/traceId/mensaje, max 256KB
  - Crear backend/src/observability/metrics-publisher.ts: métricas custom 1s (fps, latencia, error rate, websocket connections)
  - Crear backend/src/observability/alarm-handler.ts: remediación automática (reinicio, escalado), max 3 intentos/2min, escala a crítico si falla
  - Crear alarmas: latencia p99 > 2s, error > 5%/5min, pérdida frames > 0.1%/60s
  - Crear tests y property test (Property 18: formato logs)

- [x] 15. Implementar frontend hosting (CloudFront + S3)
  - Crear S3 bucket para SPA assets (block public access, cifrado KMS)
  - Crear CloudFront distribution: OAC, TLS 1.2, security headers, cache policy SPA
  - Asociar WAF WebACL a CloudFront
  - Configurar behaviors: /* → S3, /api/* → API Gateway REST, /ws → WebSocket
  - Crear script deploy frontend con invalidación de cache

- [x] 16. Implementar pipeline CI/CD (GitHub Actions)
  - Crear .github/workflows/ci.yml: lint, unit tests, property tests, CDK synth, cdk-nag, coverage
  - Crear .github/workflows/deploy-dev.yml: CI + CDK deploy dev + frontend deploy + smoke tests
  - Crear .github/workflows/deploy-staging.yml: CI + CDK deploy staging + integration tests
  - Crear .github/workflows/deploy-prod.yml: aprobación manual + CDK deploy prod + rollback automático si falla
  - Crear .github/workflows/security-scan.yml: npm audit, CodeQL, semanal
  - Configurar branch protection para main y develop

- [x] 17. Crear datos de ejemplo y configuración de circuitos
  - Crear configuraciones JSON de circuitos (Monza, Silverstone, Spa): línea óptima, sectores, rangos métricas
  - Crear datos de ejemplo: FrameMessage, InferenceResult, MetricasFrame, sesión de carrera
  - Crear frames de ejemplo anotados para testing de modelos CV
  - Crear series temporales de ejemplo para testing de modelos predictivos
  - Crear script seed-data.ts para cargar datos en S3/DynamoDB/Timestream

- [x] 18. Crear documentación de seguridad, despliegue y permisos
  - Crear docs/security/iam-model.md: roles, políticas, matriz permisos, auditoría
  - Crear docs/security/encryption.md: KMS, TLS, cifrado reposo, Secrets Manager
  - Crear docs/security/waf-rules.md: reglas WAF documentadas
  - Crear docs/deployment/step-by-step.md: prerequisitos, config ambientes, primer deploy, modelos ML, verificación, rollback
  - Crear docs/architecture/decisions.md: ADRs (CDK, Kinesis, DDB+Timestream, Bedrock, WebSocket)
  - Actualizar README.md con badges CI, diagrama simplificado, links documentación

- [x] 19. Implementar tests de integración y rendimiento end-to-end
  - Crear test pipeline e2e: frame → CV → métricas → persistencia (latencia < 2s)
  - Crear test auth e2e: login MFA, token claims por rol, denegación de acceso
  - Crear test storage: escritura/lectura DDB, consulta Timestream, búsqueda OpenSearch
  - Crear test latencia: frame < 500ms, e2e < 2s p99, insight < 3s
  - Crear test carga: 20 streams simultáneos 30fps, 1000 WebSocket connections
  - Crear test WebSocket: conectar, autenticar, suscribir, recibir updates, reconexión

## Task Dependency Graph

```json
{
  "waves": [
    [1],
    [2, 16],
    [3, 4, 14],
    [5, 6, 13],
    [7],
    [8, 9, 17],
    [10],
    [11],
    [12, 15],
    [18],
    [19]
  ]
}
```

## Notes

- Las tareas 3 y 4 se pueden ejecutar en paralelo una vez completada la tarea 2 (CDK base).
- Las tareas 5 y 6 se pueden ejecutar en paralelo una vez completadas las tareas 3 y 4.
- Las tareas 8 y 9 se pueden ejecutar en paralelo una vez completada la tarea 7.
- La tarea 16 (CI/CD) puede iniciarse temprano (después de tarea 1) e ir iterándose.
- La tarea 19 (tests e2e) requiere que todos los subsistemas estén implementados.
- Cada tarea incluye sus propios tests unitarios y property-based tests donde aplica.
- Todas las 18 propiedades de correctitud del diseño tienen cobertura PBT asignada.
