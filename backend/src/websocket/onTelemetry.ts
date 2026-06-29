/**
 * Lambda: onTelemetry
 * Triggered by API Gateway WebSocket 'telemetry' route.
 * Stores frame in DynamoDB, broadcasts to all frontend subscribers.
 */
import { DynamoDBClient, PutItemCommand, QueryCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';

const ddb = new DynamoDBClient({});

const TELEMETRY_TABLE = process.env.TELEMETRY_TABLE_NAME!;
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE_NAME!;
const WS_ENDPOINT = process.env.WS_ENDPOINT!; // https://{api-id}.execute-api.{region}.amazonaws.com/{stage}

let apigw: ApiGatewayManagementApiClient | null = null;

function getApigw(endpoint: string): ApiGatewayManagementApiClient {
  if (!apigw) {
    apigw = new ApiGatewayManagementApiClient({ endpoint });
  }
  return apigw;
}

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const body = JSON.parse(event.body || '{}');
  const driverId = body.driverId;
  const data = body.data;

  // Validate driverId
  if (!driverId || driverId < 1 || driverId > 4) {
    console.log({ action: 'reject_telemetry', reason: 'invalid_driver_id', connectionId, driverId });
    return { statusCode: 400 };
  }

  const serverTimestamp = Date.now();

  // Store in DynamoDB
  try {
    const ttl = Math.floor(serverTimestamp / 1000) + 86400 * 30; // 30-day TTL
    await ddb.send(new PutItemCommand({
      TableName: TELEMETRY_TABLE,
      Item: {
        driverId: { S: `DRIVER#${driverId}` },
        timestamp: { N: String(serverTimestamp) },
        data: { S: JSON.stringify(data) },
        sourceConnectionId: { S: connectionId },
        ttl: { N: String(ttl) },
      },
    }));
  } catch (err) {
    console.error({ action: 'ddb_write_error', error: (err as Error).message });
    // Continue to broadcast even if DDB write fails
  }

  // Get all frontend connections
  let frontendConnections: string[] = [];
  try {
    const result = await ddb.send(new QueryCommand({
      TableName: CONNECTIONS_TABLE,
      IndexName: 'clientType-index',
      KeyConditionExpression: 'clientType = :ct',
      ExpressionAttributeValues: { ':ct': { S: 'frontend' } },
      ProjectionExpression: 'connectionId',
    }));
    frontendConnections = (result.Items || []).map(item => item.connectionId.S!);
  } catch (err) {
    console.error({ action: 'query_frontends_error', error: (err as Error).message });
  }

  // Broadcast to frontends
  if (frontendConnections.length > 0) {
    const broadcastPayload = JSON.stringify({
      type: 'telemetry',
      driverId,
      serverTimestamp,
      data,
    });

    const endpoint = WS_ENDPOINT.replace('wss://', 'https://').replace('ws://', 'http://');
    const client = getApigw(endpoint);

    const staleConnections: string[] = [];

    await Promise.allSettled(
      frontendConnections.map(async (connId) => {
        try {
          await client.send(new PostToConnectionCommand({
            ConnectionId: connId,
            Data: Buffer.from(broadcastPayload),
          }));
        } catch (err: any) {
          if (err.statusCode === 410 || err.$metadata?.httpStatusCode === 410) {
            staleConnections.push(connId);
          }
        }
      })
    );

    // Clean up stale connections
    for (const staleId of staleConnections) {
      try {
        await ddb.send(new DeleteItemCommand({
          TableName: CONNECTIONS_TABLE,
          Key: { connectionId: { S: staleId } },
        }));
      } catch { /* ignore cleanup errors */ }
    }
  }

  return { statusCode: 200 };
};
