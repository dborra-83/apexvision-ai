# ApexVision AI

Plataforma de análisis de rendimiento de Fórmula 1 en tiempo real, construida 100% sobre servicios AWS. Ingesta video de cámaras onboard, extrae métricas frame a frame mediante visión por computadora, genera insights con IA Generativa y predice estrategias óptimas de carrera.

## Arquitectura

```
Cámara F1 → Kinesis Video Streams → Lambda/SageMaker (CV)
  → Extracción de métricas → DynamoDB/Timestream
  → Amazon Bedrock (insights + predicción)
  → EventBridge (alertas)
  → API Gateway WebSocket → Dashboard (Cognito-auth)
  → CloudFront/WAF
```

### Componentes principales

| Componente | Servicio AWS | Función |
|-----------|-------------|---------|
| Ingesta | Kinesis Video Streams + Data Streams | Video en vivo 20 pilotos × 30fps |
| Visión | SageMaker (YOLO) + ECS Fargate GPU | Detección/segmentación < 500ms |
| Métricas | Lambda + DynamoDB + Timestream | Cálculo y persistencia < 2s e2e |
| IA Generativa | Amazon Bedrock + Knowledge Bases | Insights y recomendaciones |
| Predicción | SageMaker (DeepAR + clasificación) | Pit stops, anomalías, adelantamientos |
| Alertas | EventBridge + SNS | Tiempo real por severidad |
| API | API Gateway REST + WebSocket | Push en vivo al dashboard |
| Dashboard | React SPA + CloudFront | Visualización 20 pilotos simultáneos |
| Auth | Cognito (MFA) + IAM | 4 roles con least-privilege |
| Seguridad | WAF + KMS + Secrets Manager | Cifrado e2e, OWASP Top 10 |
| IaC | AWS CDK (TypeScript) | Reproducible, validado con cdk-nag |
| CI/CD | GitHub Actions | GitFlow → dev/staging/prod |

## Estructura del monorepo

```
apexvision-ai/
├── infrastructure/     # AWS CDK stacks (TypeScript)
├── backend/            # Lambdas y lógica de negocio
├── frontend/           # Dashboard React SPA
├── ml-models/          # Notebooks y scripts de entrenamiento
├── docs/               # Documentación técnica
├── .github/workflows/  # Pipelines CI/CD
└── .kiro/specs/        # Especificaciones del proyecto
```

## Prerequisitos

- Node.js 20 LTS
- AWS CLI v2 configurado con credenciales
- AWS CDK CLI (`npm install -g aws-cdk`)
- Cuenta AWS con permisos de administración (para bootstrap)

## Setup local

```bash
# Clonar repositorio
git clone https://github.com/dborra-83/apexvision-ai.git
cd apexvision-ai

# Instalar dependencias
npm install

# Build completo
npm run build

# Ejecutar tests
npm run test
```

## Despliegue

```bash
# Bootstrap CDK (primera vez por cuenta/región)
cd infrastructure
npx cdk bootstrap aws://ACCOUNT_ID/REGION

# Deploy a desarrollo
npm run deploy:dev

# Deploy a staging
npm run deploy:staging

# Deploy a producción (requiere aprobación)
npm run deploy:prod
```

## Roles de usuario

| Rol | Acceso |
|-----|--------|
| Admin | Total: gestión de usuarios, configuración, todas las métricas |
| Ingeniero de Pista | Tiempo real: métricas, estrategia, alertas |
| Analista | Histórico: datos comparativos, reportes, exportación |
| Viewer | Solo lectura: dashboard sin modificaciones |

## Métricas de rendimiento

El sistema extrae las siguientes métricas frame a frame:

- **Velocidad aparente** (km/h, resolución 0.1)
- **Posición en línea de carrera** (desviación lateral en metros)
- **Intensidad de frenado** (0-100%)
- **Ángulo de dirección** (-180° a +180°)
- **Desgaste estimado de neumáticos** (0-100%)

Latencia objetivo: < 2 segundos end-to-end (p99).

## Tecnología

- **Lenguaje**: TypeScript (backend, infrastructure, frontend)
- **IaC**: AWS CDK
- **Frontend**: React 18 + Vite + TailwindCSS + Zustand
- **Testing**: Vitest + fast-check (property-based testing)
- **Monorepo**: Turborepo workspaces

## Contribución

1. Crear rama desde `develop` siguiendo GitFlow
2. Commits con [Conventional Commits](https://www.conventionalcommits.org/)
3. Pull Request hacia `develop` con descripción detallada
4. Todos los checks de CI deben pasar

## Licencia

MIT

---

Repositorio: [github.com/dborra-83/apexvision-ai](https://github.com/dborra-83/apexvision-ai)
