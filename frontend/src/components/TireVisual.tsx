/**
 * Visual tire component — SVG tire that changes color based on temperature and wear.
 * Blue (cold) → Green (optimal) → Yellow (warm) → Red (overheating)
 * Wear shown as opacity/fill reduction from outside in.
 */

interface TireVisualProps {
  temp: number;       // °C
  wear: number;       // 0-100 (% worn)
  position: string;   // "FL" "FR" "RL" "RR"
  size?: number;      // px
}

function getTireColor(temp: number): string {
  if (temp <= 0) return '#444';
  if (temp < 60) return '#3b82f6';   // Blue - cold
  if (temp < 80) return '#22c55e';   // Green - warming up
  if (temp < 95) return '#00ff87';   // Bright green - optimal
  if (temp < 105) return '#fbbf24';  // Yellow - warm
  if (temp < 115) return '#f97316';  // Orange - hot
  return '#ff1801';                   // Red - overheating
}

function getWearOpacity(wear: number): number {
  // 0% wear = full opacity, 100% wear = very faded
  return Math.max(0.3, 1 - wear / 130);
}

export function TireVisual({ temp, wear, position, size = 48 }: TireVisualProps) {
  const color = getTireColor(temp);
  const opacity = getWearOpacity(wear);
  const wearPct = Math.min(100, Math.max(0, wear));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <svg width={size} height={size * 1.4} viewBox="0 0 40 56" fill="none">
        {/* Tire outer wall */}
        <rect x="4" y="4" width="32" height="48" rx="8" ry="8"
          fill={color} opacity={opacity}
          stroke={color} strokeWidth="1.5" strokeOpacity="0.8"
        />
        {/* Tread pattern (3 grooves) */}
        <rect x="10" y="8" width="20" height="2" rx="1" fill="rgba(0,0,0,0.4)" />
        <rect x="10" y="18" width="20" height="2" rx="1" fill="rgba(0,0,0,0.4)" />
        <rect x="10" y="28" width="20" height="2" rx="1" fill="rgba(0,0,0,0.4)" />
        <rect x="10" y="38" width="20" height="2" rx="1" fill="rgba(0,0,0,0.4)" />
        <rect x="10" y="46" width="20" height="2" rx="1" fill="rgba(0,0,0,0.4)" />
        {/* Wear indicator — dark overlay from bottom up */}
        {wearPct > 0 && (
          <rect
            x="4" y={4 + 48 * (1 - wearPct / 100)}
            width="32" height={48 * (wearPct / 100)}
            rx="0" fill="rgba(0,0,0,0.5)"
            style={{ transition: 'height 0.3s, y 0.3s' }}
          />
        )}
        {/* Rim hint */}
        <ellipse cx="20" cy="28" rx="6" ry="6" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      </svg>
      {/* Position label */}
      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--rc-text-muted)', letterSpacing: '0.05em' }}>
        {position}
      </span>
      {/* Temp */}
      <span style={{ fontSize: '13px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color, lineHeight: 1 }}>
        {temp > 0 ? `${temp}°` : '--'}
      </span>
      {/* Wear bar */}
      {wearPct > 0 && (
        <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{
            width: `${wearPct}%`, height: '100%', borderRadius: '2px',
            background: wearPct > 70 ? '#ff1801' : wearPct > 50 ? '#fbbf24' : '#22c55e',
            transition: 'width 0.3s',
          }} />
        </div>
      )}
    </div>
  );
}
