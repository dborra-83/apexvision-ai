/**
 * Lambda: onConnect
 * Triggered by API Gateway WebSocket $connect route.
 * Validates API key from query string, registers connection in DynamoDB.
 */
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';
import { timingSafeEqual } from 'crypto';

const ddb = new DynamoDBClient({});
const ssm = new SSMClient({});

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE_NAME!;
const API_KEY_PARAM = process.env.API_KEY_PARAM_NAME || '/apexvision/api-key';

// Cache API key for 60 seconds
let cachedKey: string | null = null;
let cacheExpiry = 0;

async function getApiKey(): Promise<string> {
  const now = Date.now();
  if (cachedKey && now < cacheExpiry) return cachedKey;

  const result = await ssm.send(new GetParameterCommand({
    Name: API_KEY_PARAM,
    WithDecryption: true,
  }));
  cachedKey = result.Parameter?.Value || '';
  cacheExpiry = now + 60_000; // 60s TTL
  return cachedKey;
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const qs = event.queryStringParameters || {};
  const apiKey = qs.apiKey || '';
  const driverId = qs.driverId ? parseInt(qs.driverId) : null;
  const clientType = qs.clientType || 'unknown';

  console.log(JSON.stringify({ action: 'connect', connectionId, clientType, driverId }));

  // Validate API key
  if (!apiKey) {
    console.log({ action: 'reject', reason: 'missing_api_key', connectionId });
    return { statusCode: 401 };
  }

  const storedKey = await getApiKey();
  if (!safeCompare(apiKey, storedKey)) {
    console.log({ action: 'reject', reason: 'invalid_api_key', connectionId });
    return { statusCode: 401 };
  }

  // Validate driverId for simulators
  if (clientType === 'simulator') {
    if (!driverId || driverId < 1 || driverId > 4) {
      console.log({ action: 'reject', reason: 'invalid_driver_id', connectionId, driverId });
      return { statusCode: 400 };
    }
  }

  // Register connection
  const now = Math.floor(Date.now() / 1000);
  await ddb.send(new PutItemCommand({
    TableName: CONNECTIONS_TABLE,
    Item: {
      connectionId: { S: connectionId },
      clientType: { S: clientType },
      ...(driverId ? { driverId: { N: String(driverId) } } : {}),
      connectedAt: { N: String(now) },
      ttl: { N: String(now + 86400) }, // 24h TTL
    },
  }));

  console.log({ action: 'registered', connectionId, clientType, driverId });
  return { statusCode: 200 };
};
