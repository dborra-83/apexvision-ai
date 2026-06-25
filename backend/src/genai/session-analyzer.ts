/**
 * ApexVision AI — Session Analyzer with Amazon Bedrock (Claude Sonnet)
 *
 * Analiza datos de una sesión de iRacing guardada en DynamoDB y genera:
 * - Resumen de rendimiento
 * - Recomendaciones de mejora
 * - Comparación con sesiones anteriores
 * - Detección de patrones (frenado, consistencia, trazada)
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const bedrock = new BedrockRuntimeClient({ region: 'us-east-1' });
const ddbClient = new DynamoDBClient({ region: 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(ddbClient);

const TABLE_NAME = process.env.TABLE_NAME || 'apexvision-dev-metrics-realtime';
const MODEL_ID = 'anthropic.claude-sonnet-4-20250514';

interface LapSummary {
  lapNumber: number;
  lapTime: number;
  avgSpeed: number;
  position: number;
  fuelUsed: number;
}

/**
 * Obtiene los resúmenes de vueltas de una sesión desde DynamoDB.
 */
async function getSessionLaps(sessionId: string): Promise<LapSummary[]> {
  const result = await ddb.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `SESSION#${sessionId}`,
      ':sk': 'LAPSUMMARY#',
    },
  }));

  return (result.Items || []).map((item) => ({
    lapNumber: item.lapNumber,
    lapTime: Number(item.lapTime),
    avgSpeed: Number(item.avgSpeed),
    position: item.position,
    fuelUsed: Number(item.fuelUsed),
  }));
}

/**
 * Genera un análisis completo de la sesión usando Claude Sonnet.
 */
async function analyzeSession(sessionId: string): Promise<string> {
  const laps = await getSessionLaps(sessionId);

  if (laps.length === 0) {
    return 'No lap data found for this session.';
  }

  const bestLap = Math.min(...laps.map((l) => l.lapTime));
  const avgLap = laps.reduce((s, l) => s + l.lapTime, 0) / laps.length;
  const consistency = Math.sqrt(laps.reduce((s, l) => s + Math.pow(l.lapTime - avgLap, 2), 0) / laps.length);

  const prompt = `You are an expert motorsport race engineer analyzing telemetry data from an iRacing session.

SESSION DATA:
- Total laps: ${laps.length}
- Best lap: ${formatTime(bestLap)}
- Average lap: ${formatTime(avgLap)}
- Consistency (std dev): ${consistency.toFixed(3)}s
- Final position: P${laps[laps.length - 1]?.position || '?'}

LAP TIMES:
${laps.map((l) => `  Lap ${l.lapNumber}: ${formatTime(l.lapTime)} (${l.lapTime > avgLap ? '+' : ''}${(l.lapTime - avgLap).toFixed(3)}s vs avg) | ${l.avgSpeed.toFixed(0)} km/h avg | P${l.position}`).join('\n')}

Please provide:
1. **Session Summary** — overall performance assessment (2-3 sentences)
2. **Consistency Analysis** — are lap times stable? Where do you see degradation?
3. **Key Recommendations** — 3 specific actionable tips to improve (based on the lap time patterns)
4. **Tire/Fuel Strategy** — any suggestions based on fuel usage and lap time degradation
5. **Comparison** — how does the consistency compare to typical sim racing standards?

Respond in Spanish. Be specific and data-driven.`;

  const response = await bedrock.send(new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  }));

  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  return responseBody.content[0]?.text || 'No analysis generated.';
}

function formatTime(t: number): string {
  if (t <= 0) return '--:--.---';
  const min = Math.floor(t / 60);
  const sec = (t % 60).toFixed(3).padStart(6, '0');
  return `${min}:${sec}`;
}

/**
 * Lambda handler — analiza una sesión y retorna insights.
 */
export async function handler(event: { sessionId?: string }): Promise<{
  statusCode: number;
  body: string;
}> {
  const sessionId = event.sessionId;

  if (!sessionId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'sessionId required' }) };
  }

  try {
    const analysis = await analyzeSession(sessionId);
    return {
      statusCode: 200,
      body: JSON.stringify({ sessionId, analysis, generatedAt: new Date().toISOString() }),
    };
  } catch (error) {
    console.error('Analysis failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Analysis failed', details: String(error) }),
    };
  }
}
