#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';

import { NetworkingStack } from '../lib/stacks/networking-stack';
import { AuthStack } from '../lib/stacks/auth-stack';
import { StorageStack } from '../lib/stacks/storage-stack';
import { IngestionStack } from '../lib/stacks/ingestion-stack';
import { VisionStack } from '../lib/stacks/vision-stack';
import { ApiStack } from '../lib/stacks/api-stack';
import { FrontendStack } from '../lib/stacks/frontend-stack';
import { ObservabilityStack } from '../lib/stacks/observability-stack';

const app = new cdk.App();

// Determinar ambiente desde contexto
const envName = app.node.tryGetContext('env') || 'dev';
const environments = app.node.tryGetContext('environments');
const envConfig = environments?.[envName] || {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  prefix: 'dev',
};

const env: cdk.Environment = {
  account: envConfig.account,
  region: envConfig.region,
};

const prefix = `apexvision-${envConfig.prefix}`;

// Tags globales
cdk.Tags.of(app).add('Project', 'ApexVision-AI');
cdk.Tags.of(app).add('Environment', envName);
cdk.Tags.of(app).add('ManagedBy', 'CDK');

// Aplicar validaciones de seguridad cdk-nag (deshabilitado para primer deploy)
// Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

// --- Stacks ---

// 1. Networking (VPC)
const networkingStack = new NetworkingStack(app, `${prefix}-networking`, {
  env,
  prefix,
});

// 2. Observabilidad (alarmas, logs, SNS)
const observabilityStack = new ObservabilityStack(app, `${prefix}-observability`, {
  env,
  prefix,
});

// 3. Auth (Cognito)
const authStack = new AuthStack(app, `${prefix}-auth`, {
  env,
  prefix,
});

// 4. Storage (DynamoDB, Timestream, S3, KMS)
const storageStack = new StorageStack(app, `${prefix}-storage`, {
  env,
  prefix,
});

// 5. Ingestion (Kinesis)
const ingestionStack = new IngestionStack(app, `${prefix}-ingestion`, {
  env,
  prefix,
  encryptionKey: storageStack.encryptionKey,
  dataBucket: storageStack.dataBucket,
  maxPilotos: app.node.tryGetContext('maxPilotos') || 20,
  frameRate: app.node.tryGetContext('frameRate') || 30,
});
ingestionStack.addDependency(storageStack);

// 6. Vision (SageMaker + Lambda)
const visionStack = new VisionStack(app, `${prefix}-vision`, {
  env,
  prefix,
  vpc: networkingStack.vpc,
  frameStream: ingestionStack.frameStream,
});
visionStack.addDependency(networkingStack);
visionStack.addDependency(ingestionStack);

// 7. API (REST + WebSocket)
const apiStack = new ApiStack(app, `${prefix}-api`, {
  env,
  prefix,
  userPool: authStack.userPool,
  metricsTable: storageStack.metricsTable,
});
apiStack.addDependency(authStack);
apiStack.addDependency(storageStack);

// 8. Frontend (CloudFront + S3 + WAF)
const frontendStack = new FrontendStack(app, `${prefix}-frontend`, {
  env,
  prefix,
  encryptionKey: storageStack.encryptionKey,
});
frontendStack.addDependency(storageStack);
