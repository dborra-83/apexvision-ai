/**
 * Lambda: AI Race Engineer powered by Amazon Bedrock (Claude Sonnet)
 * Receives telemetry frame, returns real-time recommendations
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrock = new BedrockRuntimeClient({ region: 'us-east-1' });
const MODEL_ID = 'anthropic.claude-sonnet-4-20250514';

interface TelemetryInput {
  speed: number;
  rpm: number;
  gear: number;
  throttle: number;
  brake: number;
  steering: number;
  lap: number;
  lapTime: number;
  lastLapTime: number;
  bestLapTime: number;
  deltaToSessionBest: number;
  fuelPercent: number;
  tireTemps: { lf: number; rf: number; lr: number; rr: number };
  tireWear: { lf: number; rf: number; lr: number; rr: number };
  position: number;
  handling: string;
  absActive: boolean;
  gLateral: number;
  gLongitudinal: number;
}

export async function handler(event: { body?: string }) {
  const telemetry: TelemetryInput = JSON.parse(event.body || '{}');

  const prompt = `You are an expert sim racing engineer analyzing live telemetry from iRacing.
Based on the following telemetry snapshot, provide 1-2 short actionable recommendations.

TELEMETRY:
- Speed: ${telemetry.speed} km/h | RPM: ${telemetry.rpm} | Gear: ${telemetry.gear}
- Throttle: ${(telemetry.throttle * 100).toFixed(0)}% | Brake: ${(telemetry.brake * 100).toFixed(0)}%
- Steering: ${(telemetry.steering * 180).toFixed(0)}°
- Lap: ${telemetry.lap} | Current time: ${telemetry.lapTime?.toFixed(3)}s | Best: ${telemetry.bestLapTime?.toFixed(3)}s
- Delta to best: ${telemetry.deltaToSessionBest > 0 ? '+' : ''}${telemetry.deltaToSessionBest?.toFixed(3)}s
- Position: P${telemetry.position}
- Fuel: ${telemetry.fuelPercent?.toFixed(1)}%
- Tire temps: LF=${telemetry.tireTemps?.lf}° RF=${telemetry.tireTemps?.rf}° LR=${telemetry.tireTemps?.lr}° RR=${telemetry.tireTemps?.rr}°
- Tire wear: LF=${telemetry.tireWear?.lf}% RF=${telemetry.tireWear?.rf}% LR=${telemetry.tireWear?.lr}% RR=${telemetry.tireWear?.rr}%
- Handling: ${telemetry.handling} | ABS: ${telemetry.absActive ? 'ACTIVE' : 'off'}
- G-Force: Lateral ${telemetry.gLateral?.toFixed(2)}g | Longitudinal ${telemetry.gLongitudinal?.toFixed(2)}g

Respond ONLY with a JSON array of recommendations:
[{"category":"braking|line|tires|fuel|setup|pace","priority":"info|suggestion|critical","message":"<short actionable tip>","confidence":0.0-1.0}]

Be specific, data-driven, concise (max 20 words per message). Focus on what the driver can improve RIGHT NOW.`;

  try {
    const response = await bedrock.send(new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    }));

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const text = responseBody.content?.[0]?.text || '[]';

    // Extract JSON array from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const recommendations = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ recommendations, model: MODEL_ID, timestamp: Date.now() }),
    };
  } catch (error: any) {
    console.error('Bedrock error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message, recommendations: [] }),
    };
  }
}
