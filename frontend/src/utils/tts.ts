/**
 * Race Radio TTS — Amazon Polly via the local iracing_live.py bridge (port 8766).
 * Plays audio with a bandpass filter + noise burst to simulate an F1-style radio.
 *
 * No credentials stored here. The bridge uses whatever AWS credentials are
 * configured in the environment (aws configure / IAM role / env vars).
 */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

/** Derive HTTP bridge URL from the WebSocket URL stored in state. */
function bridgeHttpUrl(wsUrl: string): string {
  const base = wsUrl.replace(/^wss?:\/\//, 'http://');
  return /:\d+$/.test(base) ? base.replace(/:\d+$/, ':8766') : `${base}:8766`;
}

/** Strip emojis and format text so Polly speaks it naturally. */
function cleanForSpeech(text: string): string {
  return text
    // Remove emoji ranges
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    // Standalone symbols
    .replace(/[⬆️⬇️🔵🟡🏁🏅📊📉📈🔧🛞💧🌡️⛽🏎️💨]/gu, '')
    // Punctuation cleanup
    .replace(/\s*—\s*/g, '. ')
    .replace(/Δ/g, 'delta')
    .replace(/\+(\d)/g, 'más $1')
    .replace(/\s{2,}/g, ' ')
    .replace(/\.\s*\./g, '.')
    .trim();
}

/** Play a brief noise burst — simulates the radio squelch click. */
async function radioClick(ctx: AudioContext, volume = 0.18): Promise<void> {
  const sampleRate = ctx.sampleRate;
  const durationSamples = Math.floor(sampleRate * 0.07);
  const buf = ctx.createBuffer(1, durationSamples, sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < durationSamples; i++) {
    const env = Math.min(1, (durationSamples - i) / (durationSamples * 0.4));
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;

  const filt = ctx.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.value = 3000;
  filt.Q.value = 1.5;

  const gain = ctx.createGain();
  gain.gain.value = volume;

  src.connect(filt);
  filt.connect(gain);
  gain.connect(ctx.destination);

  return new Promise((res) => {
    src.onended = () => res();
    src.start();
  });
}

/** Play decoded audio through a radio bandpass chain (300 Hz – 3 kHz). */
async function playRadioAudio(ctx: AudioContext, arrayBuffer: ArrayBuffer): Promise<void> {
  const audioBuf = await ctx.decodeAudioData(arrayBuffer);
  const src = ctx.createBufferSource();
  src.buffer = audioBuf;

  // Simulate narrowband radio: boost mids, cut lows/highs
  const hi = ctx.createBiquadFilter();
  hi.type = 'highpass';
  hi.frequency.value = 280;

  const lo = ctx.createBiquadFilter();
  lo.type = 'lowpass';
  lo.frequency.value = 3200;

  const mid = ctx.createBiquadFilter();
  mid.type = 'peaking';
  mid.frequency.value = 1600;
  mid.Q.value = 0.6;
  mid.gain.value = 4;

  const gain = ctx.createGain();
  gain.gain.value = 1.4;

  src.connect(hi);
  hi.connect(lo);
  lo.connect(mid);
  mid.connect(gain);
  gain.connect(ctx.destination);

  return new Promise((res) => {
    src.onended = () => res();
    src.start();
  });
}

// Simple single-slot queue: one message playing at a time; if busy, buffer only the latest
let busy = false;
let pending: (() => void) | null = null;

async function runSpeak(text: string, lang: string, wsUrl: string): Promise<void> {
  busy = true;
  try {
    const cleaned = cleanForSpeech(text);
    if (!cleaned) return;

    const url = `${bridgeHttpUrl(wsUrl)}/api/tts`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleaned, lang }),
    });
    if (!res.ok) return;

    const mp3 = await res.arrayBuffer();
    const ctx = getCtx();
    if (ctx.state === 'suspended') await ctx.resume();

    await radioClick(ctx);
    await playRadioAudio(ctx, mp3);
    await radioClick(ctx, 0.12);
  } catch {
    // Fail silently — Polly unavailable or bridge not running
  } finally {
    busy = false;
    if (pending) {
      const next = pending;
      pending = null;
      next();
    }
  }
}

/**
 * Speak a recommendation via Polly with a radio effect.
 * Call this from the useEffect that detects new AI recommendations.
 * If already speaking, the latest message replaces the pending slot.
 */
export function speakRecommendation(text: string, lang: string, wsUrl: string): void {
  if (!wsUrl) return;
  const task = () => runSpeak(text, lang, wsUrl);
  if (busy) {
    pending = task; // replace any waiting message with the freshest one
  } else {
    task();
  }
}
