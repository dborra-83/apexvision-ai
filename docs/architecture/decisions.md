# Architecture Decision Records (ADR)

## ADR-001: AWS CDK con TypeScript como IaC

**Contexto**: Necesitamos infraestructura reproducible y validable.
**Decisión**: AWS CDK con TypeScript sobre Terraform.
**Razones**: Type-safety, reutilización de constructs, cdk-nag para validaciones de seguridad, mismo lenguaje que backend.

## ADR-002: Kinesis Video Streams para ingesta

**Contexto**: Ingesta de 20 streams de video simultáneos a 30fps.
**Decisión**: Amazon Kinesis Video Streams + Kinesis Data Streams.
**Razones**: Integración nativa con AWS, soporte de fragmentos, consumer API, retención configurable.

## ADR-003: DynamoDB + Timestream para dual storage

**Contexto**: Necesitamos acceso sub-segundo para tiempo real Y consultas históricas eficientes.
**Decisión**: DynamoDB para métricas de acceso rápido (TTL 24h) + Timestream para series temporales históricas.
**Razones**: DynamoDB ofrece latencia consistente < 10ms; Timestream optimizado para queries de series temporales con retención configurable.

## ADR-004: Amazon Bedrock para IA Generativa

**Contexto**: Generación de insights en lenguaje natural en < 3 segundos.
**Decisión**: Amazon Bedrock (Claude) con Knowledge Bases sobre un modelo custom fine-tuned.
**Razones**: Sin infraestructura de GPU para LLM, modelos actualizados automáticamente, Knowledge Bases con RAG para reglas F1, pay-per-token.

## ADR-005: WebSocket API Gateway para tiempo real

**Contexto**: Push de métricas al dashboard con latencia < 500ms.
**Decisión**: API Gateway WebSocket sobre polling HTTP o AppSync.
**Razones**: Costo efectivo, integración directa con Lambda, gestión de conexiones serverless, soporta 1000+ conexiones concurrentes sin provisioning.

## ADR-006: Monorepo con Turborepo

**Contexto**: Proyecto con 3 packages (infrastructure, backend, frontend) que comparten tipos.
**Decisión**: Monorepo con npm workspaces + Turborepo.
**Razones**: Tipos compartidos sin publish, builds incrementales, CI unificado, una sola versión de dependencias.
