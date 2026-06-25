import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

export interface ObservabilityStackProps extends cdk.StackProps {
  readonly prefix: string;
}

/**
 * Stack de observabilidad.
 * Configura CloudWatch dashboards, alarmas, temas SNS para notificaciones
 * y log groups con retención configurada.
 */
export class ObservabilityStack extends cdk.Stack {
  public readonly operationsTopic: sns.ITopic;
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: ObservabilityStackProps) {
    super(scope, id, props);

    // Tema SNS para notificaciones de operaciones
    this.operationsTopic = new sns.Topic(this, 'OperationsTopic', {
      topicName: `${props.prefix}-operations-alerts`,
      displayName: 'ApexVision AI - Alertas de Operaciones',
    });

    // Dashboard principal de CloudWatch
    this.dashboard = new cloudwatch.Dashboard(this, 'MainDashboard', {
      dashboardName: `${props.prefix}-main`,
    });

    // Widget placeholder - se agregarán métricas específicas en tareas posteriores
    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '# ApexVision AI - Dashboard Operativo\n\nMétricas del sistema de procesamiento en tiempo real.',
        width: 24,
        height: 2,
      })
    );

    // Log group para logs centralizados de aplicación
    new logs.LogGroup(this, 'ApplicationLogs', {
      logGroupName: `/apexvision/${props.prefix}/application`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Alarma: latencia end-to-end > 2s (p99)
    const latencyAlarm = new cloudwatch.Alarm(this, 'LatencyAlarm', {
      alarmName: `${props.prefix}-latency-p99-high`,
      alarmDescription: 'Latencia end-to-end de procesamiento de frame supera 2s (p99)',
      metric: new cloudwatch.Metric({
        namespace: 'ApexVision',
        metricName: 'FrameProcessingLatency',
        statistic: 'p99',
        period: cdk.Duration.minutes(1),
      }),
      threshold: 2000,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    latencyAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.operationsTopic));

    // Alarma: tasa de error > 5%
    const errorRateAlarm = new cloudwatch.Alarm(this, 'ErrorRateAlarm', {
      alarmName: `${props.prefix}-error-rate-high`,
      alarmDescription: 'Tasa de error superior al 5% en ventana de 5 minutos',
      metric: new cloudwatch.Metric({
        namespace: 'ApexVision',
        metricName: 'ErrorRate',
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 5,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    errorRateAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.operationsTopic));

    // Outputs
    new cdk.CfnOutput(this, 'OperationsTopicArn', {
      value: this.operationsTopic.topicArn,
      exportName: `${props.prefix}-operations-topic-arn`,
    });
  }
}
