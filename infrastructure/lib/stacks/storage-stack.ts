import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';

export interface StorageStackProps extends cdk.StackProps {
  readonly prefix: string;
}

/**
 * Stack de almacenamiento.
 * Configura DynamoDB (métricas tiempo real), Timestream (series temporales),
 * S3 (frames y datasets) y KMS (cifrado).
 */
export class StorageStack extends cdk.Stack {
  public readonly metricsTable: dynamodb.ITable;
  public readonly sessionsTable: dynamodb.ITable;
  public readonly dataBucket: s3.IBucket;
  public readonly encryptionKey: kms.IKey;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    // KMS CMK para cifrado de todos los servicios
    const key = new kms.Key(this, 'EncryptionKey', {
      alias: `${props.prefix}-cmk`,
      description: 'CMK para cifrado de datos ApexVision AI',
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    this.encryptionKey = key;

    // DynamoDB - Métricas en tiempo real
    const metricsTable = new dynamodb.Table(this, 'MetricsTable', {
      tableName: `${props.prefix}-metrics-realtime`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: key,
      timeToLiveAttribute: 'ttl',
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    metricsTable.addGlobalSecondaryIndex({
      indexName: 'sessionId-timestamp-index',
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestampCaptura', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    this.metricsTable = metricsTable;

    // DynamoDB - Sesiones
    this.sessionsTable = new dynamodb.Table(this, 'SessionsTable', {
      tableName: `${props.prefix}-sessions`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: key,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // S3 - Datos (frames, video, datasets)
    const dataBucket = new s3.Bucket(this, 'DataBucket', {
      bucketName: `${props.prefix}-data-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: key,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: 'IntelligentTiering30d',
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(30),
            },
          ],
        },
        {
          id: 'GlacierArchive90d',
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
      ],
    });
    this.dataBucket = dataBucket;

    // Tabla DynamoDB para series temporales (reemplaza Timestream)
    const timeseriesTable = new dynamodb.Table(this, 'TimeseriesTable', {
      tableName: `${props.prefix}-timeseries`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: key,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Outputs
    new cdk.CfnOutput(this, 'MetricsTableName', {
      value: metricsTable.tableName,
      exportName: `${props.prefix}-metrics-table-name`,
    });

    new cdk.CfnOutput(this, 'DataBucketName', {
      value: dataBucket.bucketName,
      exportName: `${props.prefix}-data-bucket-name`,
    });

    new cdk.CfnOutput(this, 'KmsKeyArn', {
      value: key.keyArn,
      exportName: `${props.prefix}-kms-key-arn`,
    });
  }
}
