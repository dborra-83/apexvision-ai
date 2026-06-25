/**
 * Utilidad para listar y cargar sesiones.
 * Prioridad:
 *   1. HTTP API local (iracing_live.py sirve sesiones en puerto 8766)
 *   2. AWS S3 via Amplify Storage (producción con Cognito)
 *   3. Manual file upload (fallback)
 */

import { list, downloadData } from 'aws-amplify/storage';

// URL base del servidor HTTP local de iracing_live.py
const LOCAL_API_BASE = import.meta.env.VITE_SESSIONS_API || 'http://localhost:8766';

export interface SessionListItem {
  name: string;
  driver: string;
  car: string;
  track: string;
  date: string;
  sessionName: string;
  source: 'local' | 's3';
}

// ============================================================
// LOCAL API (iracing_live.py HTTP server)
// ============================================================

async function listSessionsLocal(): Promise<SessionListItem[]> {
  const res = await fetch(`${LOCAL_API_BASE}/api/sessions`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: SessionListItem[] = await res.json();
  return data.map((s) => ({ ...s, source: 'local' as const }));
}

async function downloadSessionFileLocal(sessionName: string, filename: string): Promise<string> {
  const res = await fetch(`${LOCAL_API_BASE}/api/sessions/${sessionName}/${filename}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// ============================================================
// S3 via Amplify Storage
// ============================================================

async function listSessionsS3(): Promise<SessionListItem[]> {
  const result = await list({
    path: 'sessions/',
    options: { listAll: true },
  });

  const sessionNames = new Set<string>();
  const sessions: SessionListItem[] = [];

  for (const item of result.items) {
    const parts = item.path.replace('sessions/', '').split('/');
    if (parts.length >= 2 && parts[0]) {
      const name = parts[0];
      if (!sessionNames.has(name)) {
        sessionNames.add(name);
        sessions.push({
          name,
          driver: '',
          car: '',
          track: '',
          date: '',
          sessionName: '',
          source: 's3',
        });
      }
    }
  }

  return sessions.sort((a, b) => b.name.localeCompare(a.name));
}

async function downloadSessionFileS3(sessionName: string, filename: string): Promise<string> {
  const result = await downloadData({
    path: `sessions/${sessionName}/${filename}`,
  }).result;
  return result.body.text();
}

// ============================================================
// PUBLIC API — tries local first, then S3
// ============================================================

export async function listSessions(): Promise<SessionListItem[]> {
  // Try local API first (works without Cognito auth)
  try {
    const local = await listSessionsLocal();
    if (local.length > 0) return local;
  } catch {
    // Local not available — try S3
  }

  // Try S3
  try {
    return await listSessionsS3();
  } catch {
    // S3 not available either
  }

  return [];
}

export async function loadSession(session: SessionListItem) {
  const downloadFn = session.source === 'local' ? downloadSessionFileLocal : downloadSessionFileS3;
  const name = session.name;

  const [infoText, lapsText, eventsText] = await Promise.allSettled([
    downloadFn(name, 'session_info.json'),
    downloadFn(name, 'lap_summaries.json'),
    downloadFn(name, 'events.jsonl'),
  ]);

  const info = infoText.status === 'fulfilled' ? JSON.parse(infoText.value) : null;
  const laps = lapsText.status === 'fulfilled' ? JSON.parse(lapsText.value) : [];
  const events = eventsText.status === 'fulfilled'
    ? eventsText.value.trim().split('\n').filter(Boolean).map((line: string) => JSON.parse(line))
    : [];

  return { info, laps, events };
}
