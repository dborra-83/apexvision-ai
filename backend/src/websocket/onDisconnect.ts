/**
 * Lambda: onDisconnect
 * Triggered by API Gateway WebSocket $disconnect route.
 * Removes connection record from DynamoDB.
 */
import { DynamoDBClient, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';

const ddb = new DynamoDBClient({});
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE_NAME!;

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId;

  console.log(JSON.stringify({ action: 'disconnect', connectionId }));

  try {
    await ddb.send(new DeleteItemCommand({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId: { S: connectionId } },
    }));
  } catch (err) {
    console.error({ action: 'delete_error', connectionId, error: (err as Error).message });
  }

  return { statusCode: 200 };
};
