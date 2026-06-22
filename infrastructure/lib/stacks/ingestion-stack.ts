import * as cdk from 'aws-cdk-lib';
import * as kinesis from 'aws-cdk-lib/aws-kinesis';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface IngestionStackProps extends cdk.StackProps {
  readonly prefix: string;
  readonly encryptionKey: kms.IKey;
  readonly dataBucket: s3.IBucket;
  readonly maxPilotos?: number;
  readonly frameRate?: number;
}

/**
 * Stack de ingesta de video.
 * Configura Kinesis Data Streams para recibir frames extraídos de
 * Kinesis Video Streams y la Lambda de extracción de frames.
 */
export class IngestionStack extends cdk.Stack {
  public readonly frameStream: kinesis.IStream;
  public readonly frameExtractorLambda: lambda.IFunction;

  constructor(scope: Construct, id: string, props: IngestionStackProps) {
    super(scope, id, props);

    const maxPilotos = props.maxPilotos || 20;
    const frameRate = props.frameRate || 30;

    // Kinesis Data Stream para frames
    // Cálculo de shards: 20 pilotos × 30fps = 600 records/s
    // Cada shard soporta 1000 records/s, con margen: 2 shards
    const shardCount = Math.ceil((maxPilotos * frameRate) / 800);

    this.frameStream = new kinesis.Stream(this, 'FrameStream', {
      streamName: `${props.prefix}-frames`,
      shardCount,
      retentionPeriod: cdk.Duration.hours(24),
      encryption: kinesis.StreamEncryption.KMS,
      encryptionKey: props.encryptionKey,
      streamMode: kinesis.StreamMode.PROVISIONED,
    });

    // Lambda Frame Extractor
    // Se activa por KVS y publica frames en Kinesis Data Streams
    this.frameExtractorLambda = new lambda.Function(this, 'FrameExtractor', {
      functionName: `${props.prefix}-frame-extractor`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../backend/dist/ingestion'),
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        FRAME_STREAM_NAME: this.frameStream.streamName,
        DATA_BUCKET_NAME: props.dataBucket.bucketName,
        MAX_PILOTOS: maxPilotos.toString(),
      },
      tracing: lambda.Tracing.ACTIVE,
    });

    // Permisos: escribir en Kinesis y S3
    this.frameStream.grantWrite(this.frameExtractorLambda);
    props.dataBucket.grantWrite(this.frameExtractorLambda, 'raw-frames/*');

    // Outputs
    new cdk.CfnOutput(this, 'FrameStreamName', {
      value: this.frameStream.streamName,
      exportName: `${props.prefix}-frame-stream-name`,
    });

    new cdk.CfnOutput(this, 'FrameStreamArn', {
      value: this.frameStream.streamArn,
      exportName: `${props.prefix}-frame-stream-arn`,
    });
  }
}
