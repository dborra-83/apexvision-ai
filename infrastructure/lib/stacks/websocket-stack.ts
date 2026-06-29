/**
 * WebSocket API Stack — Secure multi-driver telemetry gateway
 * 
 * Resources:
 * - API Gateway WebSocket API (WSS)
 * - Lambda: onConnect, onTelemetry, onDisconnect
 * - DynamoDB: connections table, telemetry-frames table
 * - SSM Parameter: API key
 */
import * as cdk from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

interface WebSocketStackProps extends cdk.StackProps {
  prefix: string;
  stage: string;
}

export class WebSocketStack extends cdk.Stack {
  public readonly wsEndpoint: string;

  constructor(scope: Construct, id: string, props: WebSocketStackProps) {
    super(scope, id, props);

    const { prefix, stage } = props;

    // ─── DynamoDB: Connections Table ───
    const connectionsTable = new dynamodb.Table(this, 'ConnectionsTable', {
      tableName: `${prefix}-ws-connections`,
      partitionKey: { name: 'connectionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    connectionsTable.addGlobalSecondaryIndex({
      indexName: 'clientType-index',
      partitionKey: { name: 'clientType', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'connectedAt', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    connectionsTable.addGlobalSecondaryIndex({
      indexName: 'driverId-index',
      partitionKey: { name: 'driverId', type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: 'connectedAt', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ─── DynamoDB: Telemetry Frames Table ───
    const telemetryTable = new dynamodb.Table(this, 'TelemetryFramesTable', {
      tableName: `${prefix}-telemetry-frames`,
      partitionKey: { name: 'driverId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ─── SSM: API Key Parameter ───
    const apiKeyParam = new ssm.StringParameter(this, 'ApiKeyParam', {
      parameterName: '/apexvision/api-key',
      stringValue: 'CHANGE-ME-MIN-32-CHARS-ROTATE-NOW-XYZ',
      description: 'ApexVision team API key for WebSocket authentication',
      tier: ssm.ParameterTier.STANDARD,
    });

    // ─── WebSocket API ───
    const wsApi = new apigwv2.CfnApi(this, 'TelemetryWsApi', {
      name: `${prefix}-telemetry-ws`,
      protocolType: 'WEBSOCKET',
      routeSelectionExpression: '$request.body.action',
    });

    // ─── Lambda Functions ───
    const lambdaDefaults: Partial<lambda.FunctionProps> = {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      architecture: lambda.Architecture.ARM_64,
    };

    const onConnectFn = new lambda.Function(this, 'OnConnectFn', {
      ...lambdaDefaults,
      functionName: `${prefix}-ws-onConnect`,
      handler: 'onConnect.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/dist/websocket')),
      environment: {
        CONNECTIONS_TABLE_NAME: connectionsTable.tableName,
        API_KEY_PARAM_NAME: apiKeyParam.parameterName,
      },
    } as lambda.FunctionProps);

    const onTelemetryFn = new lambda.Function(this, 'OnTelemetryFn', {
      ...lambdaDefaults,
      functionName: `${prefix}-ws-onTelemetry`,
      handler: 'onTelemetry.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/dist/websocket')),
      environment: {
        TELEMETRY_TABLE_NAME: telemetryTable.tableName,
        CONNECTIONS_TABLE_NAME: connectionsTable.tableName,
        WS_ENDPOINT: `https://${wsApi.ref}.execute-api.${this.region}.amazonaws.com/${stage}`,
      },
    } as lambda.FunctionProps);

    const onDisconnectFn = new lambda.Function(this, 'OnDisconnectFn', {
      ...lambdaDefaults,
      functionName: `${prefix}-ws-onDisconnect`,
      handler: 'onDisconnect.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/dist/websocket')),
      environment: {
        CONNECTIONS_TABLE_NAME: connectionsTable.tableName,
      },
    } as lambda.FunctionProps);

    // ─── IAM Permissions ───
    connectionsTable.grantReadWriteData(onConnectFn);
    connectionsTable.grantReadWriteData(onTelemetryFn);
    connectionsTable.grantReadWriteData(onDisconnectFn);
    telemetryTable.grantWriteData(onTelemetryFn);
    apiKeyParam.grantRead(onConnectFn);

    // API Gateway management permission for broadcast
    onTelemetryFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['execute-api:ManageConnections'],
      resources: [`arn:aws:execute-api:${this.region}:${this.account}:${wsApi.ref}/${stage}/*`],
    }));

    // ─── WebSocket Routes + Integrations ───
    const connectIntegration = new apigwv2.CfnIntegration(this, 'ConnectIntegration', {
      apiId: wsApi.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${onConnectFn.functionArn}/invocations`,
    });

    const telemetryIntegration = new apigwv2.CfnIntegration(this, 'TelemetryIntegration', {
      apiId: wsApi.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${onTelemetryFn.functionArn}/invocations`,
    });

    const disconnectIntegration = new apigwv2.CfnIntegration(this, 'DisconnectIntegration', {
      apiId: wsApi.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${onDisconnectFn.functionArn}/invocations`,
    });

    new apigwv2.CfnRoute(this, 'ConnectRoute', {
      apiId: wsApi.ref,
      routeKey: '$connect',
      target: `integrations/${connectIntegration.ref}`,
    });

    new apigwv2.CfnRoute(this, 'TelemetryRoute', {
      apiId: wsApi.ref,
      routeKey: 'telemetry',
      target: `integrations/${telemetryIntegration.ref}`,
    });

    new apigwv2.CfnRoute(this, 'DisconnectRoute', {
      apiId: wsApi.ref,
      routeKey: '$disconnect',
      target: `integrations/${disconnectIntegration.ref}`,
    });

    // Lambda invoke permissions for API Gateway
    onConnectFn.addPermission('ApiGwInvoke', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${wsApi.ref}/*`,
    });
    onTelemetryFn.addPermission('ApiGwInvoke', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${wsApi.ref}/*`,
    });
    onDisconnectFn.addPermission('ApiGwInvoke', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${wsApi.ref}/*`,
    });

    // ─── Deployment + Stage ───
    const deployment = new apigwv2.CfnDeployment(this, 'WsDeployment', {
      apiId: wsApi.ref,
    });

    // Ensure deployment happens after routes
    deployment.addDependency(connectIntegration);
    deployment.addDependency(telemetryIntegration);
    deployment.addDependency(disconnectIntegration);

    new apigwv2.CfnStage(this, 'WsStage', {
      apiId: wsApi.ref,
      stageName: stage,
      deploymentId: deployment.ref,
    });

    // ─── Outputs ───
    this.wsEndpoint = `wss://${wsApi.ref}.execute-api.${this.region}.amazonaws.com/${stage}`;

    new cdk.CfnOutput(this, 'WebSocketEndpoint', {
      value: this.wsEndpoint,
      description: 'WebSocket API endpoint for telemetry connections',
      exportName: `${prefix}-ws-endpoint`,
    });

    new cdk.CfnOutput(this, 'ApiKeyParamName', {
      value: apiKeyParam.parameterName,
      description: 'SSM Parameter name for the API key (update value to rotate)',
    });
  }
}
