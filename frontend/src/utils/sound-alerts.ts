/**
 * Sound alerts for AI Race Engineer notifications.
 * Uses Web Audio API to generate tones without external audio files.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

type AlertType = 'warning' | 'tip' | 'strategy' | 'info';

const ALERT_CONFIGS: Record<AlertType, { freq: number; duration: number; type: OscillatorType; volume: number }> = {
  warning: { freq: 880, duration: 0.25, type: 'square', volume: 0.3 },   // Urgent beep
  tip: { freq: 660, duration: 0.15, type: 'sine', volume: 0.15 },        // Soft ping
  strategy: { freq: 520, duration: 0.2, type: 'triangle', volume: 0.2 }, // Medium tone
  info: { freq: 440, duration: 0.1, type: 'sine', volume: 0.1 },         // Subtle
};

let lastAlertTime = 0;
const MIN_ALERT_INTERVAL_MS = 5000; // No sonar más de 1 vez cada 5s

export function playAlertSound(type: AlertType = 'info') {
  const now = Date.now();
  if (now - lastAlertTime < MIN_ALERT_INTERVAL_MS) return;
  lastAlertTime = now;

  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const config = ALERT_CONFIGS[type];
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = config.type;
    oscillator.frequency.setValueAtTime(config.freq, ctx.currentTime);

    gainNode.gain.setValueAtTime(config.volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + config.duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + config.duration);

    // Double beep for warnings
    if (type === 'warning') {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(config.freq * 1.2, ctx.currentTime + 0.3);
      gain2.gain.setValueAtTime(config.volume, ctx.currentTime + 0.3);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3 + config.duration);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.3);
      osc2.stop(ctx.currentTime + 0.3 + config.duration);
    }
  } catch {
    // Audio not available — fail silently
  }
}

/** Must be called on user interaction to unlock audio on mobile/modern browsers */
export function unlockAudio() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
  } catch {
    // ignore
  }
}
