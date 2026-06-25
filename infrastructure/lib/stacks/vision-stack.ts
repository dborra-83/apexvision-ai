import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as kinesis from 'aws-cdk-lib/aws-kinesis';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';

export interface VisionStackProps extends cdk.StackProps {
  readonly prefix: string;
  readonly vpc: ec2.IVpc;
  readonly frameStream: kinesis.IStream;
}

/**
 * Stack de visión por computadora.
 * Configura el Lambda orquestador que consume frames de Kinesis,
 * invoca SageMaker endpoints para inferencia y produce resultados
 * de detección/segmentación.
 *
 * Nota: Los SageMaker endpoints se despliegan por separado
 * (requieren modelos entrenados).
 */
export class VisionStack extends cdk.Stack {
  public readonly orchestratorLambda: lambda.IFunction;

  constructor(scope: Construct, id: string, props: VisionStackProps) {
    super(scope, id, props);

    // Lambda Orquestador de Visión por Computadora
    this.orchestratorLambda = new lambda.Function(this, 'VisionOrchestrator', {
      functionName: `${props.prefix}-vision-orchestrator`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../backend/dist/vision'),
      memorySize: 1024,
      timeout: cdk.Duration.seconds(60),
      environment: {
        SAGEMAKER_ENDPOINT_NAME: `${props.prefix}-cv-endpoint`,
        CONFIDENCE_THRESHOLD: '0.80',
        MAX_PROCESSING_TIME_MS: '500',
        DISCARD_ALERT_THRESHOLD: '10',
      },
      tracing: lambda.Tracing.ACTIVE,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    // Event source: Kinesis Data Streams (frames)
    this.orchestratorLambda.addEventSource(
      new lambdaEventSources.KinesisEventSource(props.frameStream, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 1,
        maxBatchingWindow: cdk.Duration.seconds(1),
        retryAttempts: 2,
        bisectBatchOnError: true,
        reportBatchItemFailures: true,
      })
    );

    // Permisos para invocar SageMaker endpoint
    this.orchestratorLambda.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ['sagemaker:InvokeEndpoint'],
        resources: [
          `arn:aws:sagemaker:${this.region}:${this.account}:endpoint/${props.prefix}-cv-endpoint`,
        ],
      })
    );

    // Outputs
    new cdk.CfnOutput(this, 'VisionOrchestratorArn', {
      value: this.orchestratorLambda.functionArn,
      exportName: `${props.prefix}-vision-orchestrator-arn`,
    });
  }
}
