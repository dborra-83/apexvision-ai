# Guía de Despliegue - ApexVision AI

## Prerequisitos

- Node.js 20 LTS
- AWS CLI v2 configurado
- AWS CDK CLI: `npm install -g aws-cdk`
- Cuenta AWS con permisos de administración
- Git + acceso al repositorio

## 1. Clonar y configurar

```bash
git clone https://github.com/dborra-83/apexvision-ai.git
cd apexvision-ai
npm install
```

## 2. Configurar variables de entorno

Crear archivo `.env.local` (NO commitear):

```env
CDK_DEFAULT_ACCOUNT=123456789012
CDK_DEFAULT_REGION=us-east-1
```

Editar `infrastructure/cdk.json` con los account IDs reales.

## 3. Bootstrap CDK (primera vez)

```bash
cd infrastructure
npx cdk bootstrap aws://ACCOUNT_ID/us-east-1
```

## 4. Desplegar infraestructura

```bash
# Ambiente de desarrollo
npx cdk deploy --all --context env=dev --require-approval broadening

# Staging
npx cdk deploy --all --context env=staging --require-approval broadening

# Producción (requiere aprobación de cambios de seguridad)
npx cdk deploy --all --context env=prod --require-approval broadening
```

## 5. Desplegar modelos ML

### Modelo de Visión (SageMaker)
1. Entrenar modelo YOLO v8 en notebook (`ml-models/vision/`)
2. Registrar modelo en SageMaker Model Registry
3. Crear endpoint: `apexvision-{env}-cv-endpoint`

### Modelo de Predicción (SageMaker)
1. Entrenar DeepAR en notebook (`ml-models/prediction/`)
2. Crear endpoint: `apexvision-{env}-prediction-endpoint`

## 6. Configurar Knowledge Base (Bedrock)

1. Subir documentos de reglas F1 a S3: `s3://apexvision-{env}-data/config/knowledge-base/`
2. Crear Knowledge Base en consola de Bedrock
3. Configurar embedding model (Titan Embeddings v2)
4. Sincronizar datos

## 7. Desplegar frontend

```bash
cd frontend
npm run build
aws s3 sync dist s3://apexvision-{env}-dashboard-ACCOUNT_ID --delete
aws cloudfront create-invalidation --distribution-id DIST_ID --paths "/*"
```

## 8. Verificación post-deploy

- [ ] API REST responde: `curl https://API_URL/v1/health`
- [ ] WebSocket conecta: wscat -c wss://WS_URL
- [ ] Dashboard carga en CloudFront URL
- [ ] Login Cognito funciona con MFA
- [ ] CloudWatch dashboards muestran métricas

## Rollback

```bash
# CDK rollback automático en caso de fallo
npx cdk deploy --all --context env=prod --rollback true

# Rollback manual a versión anterior
git checkout COMMIT_HASH
npx cdk deploy --all --context env=prod
```
