export const fmtLapTime = (t: number): string =>
  t > 0 ? `${Math.floor(t / 60)}:${(t % 60).toFixed(3).padStart(6, '0')}` : '--:--.---';
