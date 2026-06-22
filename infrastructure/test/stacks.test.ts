import { describe, it, expect } from 'vitest';
import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { NetworkingStack } from '../lib/stacks/networking-stack';
import { AuthStack } from '../lib/stacks/auth-stack';
import { StorageStack } from '../lib/stacks/storage-stack';
import { IngestionStack } from '../lib/stacks/ingestion-stack';
import { VisionStack } from '../lib/stacks/vision-stack';
import { ApiStack } from '../lib/stacks/api-stack';
import { FrontendStack } from '../lib/stacks/frontend-stack';
import { ObservabilityStack } from '../lib/stacks/observability-stack';

const prefix = 'apexvision-test';
const env = { account: '123456789012', region: 'us-east-1' };

describe('CDK Stack Synthesis', () => {
  it('NetworkingStack synthesizes without errors', () => {
    const app = new cdk.App();
    const stack = new NetworkingStack(app, 'TestNetworking', { env, prefix });
    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::EC2::VPC', 1);
  });

  it('AuthStack synthesizes without errors', () => {
    const app = new cdk.App();
    const stack = new AuthStack(app, 'TestAuth', { env, prefix });
    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::Cognito::UserPool', 1);
    template.resourceCountIs('AWS::Cognito::UserPoolClient', 1);
    template.resourceCountIs('AWS::Cognito::IdentityPool', 1);
  });

  it('StorageStack synthesizes without errors', () => {
    const app = new cdk.App();
    const stack = new StorageStack(app, 'TestStorage', { env, prefix });
    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::DynamoDB::Table', 2);
    template.resourceCountIs('AWS::S3::Bucket', 1);
    template.resourceCountIs('AWS::KMS::Key', 1);
    template.resourceCountIs('AWS::Timestream::Database', 1);
    template.resourceCountIs('AWS::Timestream::Table', 1);
  });

  it('IngestionStack synthesizes without errors', () => {
    const app = new cdk.App();
    const storageStack = new StorageStack(app, 'StorageDep', { env, prefix });
    const stack = new IngestionStack(app, 'TestIngestion', {
      env,
      prefix,
      encryptionKey: storageStack.encryptionKey,
      dataBucket: storageStack.dataBucket,
    });
    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::Kinesis::Stream', 1);
    template.resourceCountIs('AWS::Lambda::Function', 1);
  });

  it('VisionStack synthesizes without errors', () => {
    const app = new cdk.App();
    const networkingStack = new NetworkingStack(app, 'NetDep', { env, prefix });
    const storageStack = new StorageStack(app, 'StorageDep2', { env, prefix });
    const ingestionStack = new IngestionStack(app, 'IngDep', {
      env,
      prefix,
      encryptionKey: storageStack.encryptionKey,
      dataBucket: storageStack.dataBucket,
    });
    const stack = new VisionStack(app, 'TestVision', {
      env,
      prefix,
      vpc: networkingStack.vpc,
      frameStream: ingestionStack.frameStream,
    });
    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::Lambda::Function', 1);
  });

  it('ApiStack synthesizes without errors', () => {
    const app = new cdk.App();
    const authStack = new AuthStack(app, 'AuthDep', { env, prefix });
    const storageStack = new StorageStack(app, 'StorageDep3', { env, prefix });
    const stack = new ApiStack(app, 'TestApi', {
      env,
      prefix,
      userPool: authStack.userPool,
      metricsTable: storageStack.metricsTable,
    });
    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
    template.resourceCountIs('AWS::ApiGatewayV2::Api', 1);
  });

  it('FrontendStack synthesizes without errors', () => {
    const app = new cdk.App();
    const storageStack = new StorageStack(app, 'StorageDep4', { env, prefix });
    const stack = new FrontendStack(app, 'TestFrontend', {
      env,
      prefix,
      encryptionKey: storageStack.encryptionKey,
    });
    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::S3::Bucket', 1);
    template.resourceCountIs('AWS::CloudFront::Distribution', 1);
    template.resourceCountIs('AWS::WAFv2::WebACL', 1);
  });

  it('ObservabilityStack synthesizes without errors', () => {
    const app = new cdk.App();
    const stack = new ObservabilityStack(app, 'TestObs', { env, prefix });
    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::SNS::Topic', 1);
    template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);
    template.resourceCountIs('AWS::CloudWatch::Alarm', 2);
  });
});
