/**
 * Futuristic circular RPM gauge — segmented arc with color zones
 */
import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface Props {
  rpm: number;
  maxRpm?: number;
  shiftPoint?: number;
}

export function D3RPMGauge({ rpm, maxRpm = 8000, shiftPoint = 7200 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const w = 220, h = 24;
    const segments = 24;
    const gap = 2;
    const segW = (w - (segments - 1) * gap) / segments;
    const activeSegs = Math.round((rpm / maxRpm) * segments);
    const shiftSeg = Math.round((shiftPoint / maxRpm) * segments);

    const defs = svg.append('defs');
    const glow = defs.append('filter').attr('id', 'rpmGlow').attr('x', '-20%').attr('y', '-20%').attr('width', '140%').attr('height', '140%');
    glow.append('feGaussianBlur').attr('stdDeviation', '2').attr('result', 'blur');
    glow.append('feMerge').selectAll('feMergeNode').data(['blur', 'SourceGraphic']).enter().append('feMergeNode').attr('in', (d: string) => d);

    for (let i = 0; i < segments; i++) {
      const active = i < activeSegs;
      const isShiftZone = i >= shiftSeg;
      let color: string;
      if (i < segments * 0.5) color = '#06b6d4';
      else if (i < segments * 0.75) color = '#3b82f6';
      else if (i < shiftSeg) color = '#f59e0b';
      else color = '#ef4444';

      const rect = svg.append('rect')
        .attr('x', i * (segW + gap))
        .attr('y', 4)
        .attr('width', segW)
        .attr('height', h - 8)
        .attr('rx', 2)
        .attr('fill', active ? color : 'var(--bg-tertiary)')
        .attr('opacity', active ? 1 : 0.2);

      // Glow on last active segment
      if (active && i === activeSegs - 1) {
        rect.attr('filter', 'url(#rpmGlow)');
      }
      // Blink effect on redline
      if (active && isShiftZone) {
        rect.attr('opacity', 0.9 + Math.sin(Date.now() / 100) * 0.1);
      }
    }
  }, [rpm, maxRpm, shiftPoint]);

  return <svg ref={svgRef} viewBox="0 0 220 24" className="w-full h-auto" />;
}
