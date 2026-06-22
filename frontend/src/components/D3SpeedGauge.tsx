/**
 * Futuristic radial speed gauge — HUD style with animated arc and glow
 */
import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface Props {
  speed: number;
  history: number[];
  maxSpeed?: number;
}

export function D3SpeedGauge({ speed, history, maxSpeed = 320 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const w = 220, h = 140, cx = w / 2, cy = h - 15;
    const r = 90;
    const startA = -Math.PI * 0.8;
    const endA = Math.PI * 0.8;
    const scale = d3.scaleLinear().domain([0, maxSpeed]).range([startA, endA]).clamp(true);

    const defs = svg.append('defs');
    // Glow filter
    const glow = defs.append('filter').attr('id', 'gaugeGlow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
    glow.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur');
    glow.append('feMerge').selectAll('feMergeNode').data(['blur', 'SourceGraphic']).enter().append('feMergeNode').attr('in', (d: string) => d);
    // Arc gradient
    const grad = defs.append('linearGradient').attr('id', 'arcGrad').attr('x1', '0%').attr('y1', '0%').attr('x2', '100%').attr('y2', '0%');
    grad.append('stop').attr('offset', '0%').attr('stop-color', '#06b6d4');
    grad.append('stop').attr('offset', '60%').attr('stop-color', '#3b82f6');
    grad.append('stop').attr('offset', '100%').attr('stop-color', '#ef4444');

    const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

    // Outer ring (subtle)
    const outerArc = d3.arc<any>().innerRadius(r + 2).outerRadius(r + 4).startAngle(startA).endAngle(endA);
    g.append('path').attr('d', outerArc({})).attr('fill', 'none').attr('stroke', 'var(--border)').attr('stroke-width', 0.5);

    // Background arc
    const bgArc = d3.arc<any>().innerRadius(r - 6).outerRadius(r).startAngle(startA).endAngle(endA);
    g.append('path').attr('d', bgArc({})).attr('fill', 'var(--bg-tertiary)').attr('opacity', 0.5);

    // Speed arc (animated)
    const speedArc = d3.arc<any>().innerRadius(r - 6).outerRadius(r).startAngle(startA).endAngle(scale(speed));
    g.append('path').attr('d', speedArc({})).attr('fill', 'url(#arcGrad)').attr('filter', 'url(#gaugeGlow)');

    // Tick marks
    for (let v = 0; v <= maxSpeed; v += 40) {
      const a = scale(v);
      const inner = r + 6, outer = r + 12;
      g.append('line')
        .attr('x1', Math.cos(a) * inner).attr('y1', Math.sin(a) * inner)
        .attr('x2', Math.cos(a) * outer).attr('y2', Math.sin(a) * outer)
        .attr('stroke', v <= speed ? 'var(--accent)' : 'var(--border)').attr('stroke-width', v % 80 === 0 ? 1.5 : 0.5);
      if (v % 80 === 0) {
        g.append('text')
          .attr('x', Math.cos(a) * (r + 18)).attr('y', Math.sin(a) * (r + 18))
          .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
          .attr('fill', 'var(--text-muted)').attr('font-size', '7px').attr('font-family', 'JetBrains Mono')
          .text(v);
      }
    }

    // Inner sparkline (mini history)
    if (history.length > 3) {
      const sparkR = r - 20;
      const sparkScale = d3.scaleLinear().domain([0, history.length - 1]).range([startA * 0.6, endA * 0.6]);
      const sparkY = d3.scaleLinear().domain([0, maxSpeed]).range([sparkR, sparkR - 25]);
      const sparkLine = d3.lineRadial<number>()
        .angle((_, i) => sparkScale(i))
        .radius(d => sparkY(d))
        .curve(d3.curveCatmullRom);
      g.append('path').datum(history).attr('d', sparkLine as any)
        .attr('fill', 'none').attr('stroke', 'var(--accent)').attr('stroke-width', 1).attr('opacity', 0.4);
    }

    // Needle
    const needleA = scale(speed);
    const needleLen = r - 12;
    g.append('line')
      .attr('x1', 0).attr('y1', 0)
      .attr('x2', Math.cos(needleA) * needleLen).attr('y2', Math.sin(needleA) * needleLen)
      .attr('stroke', 'var(--accent)').attr('stroke-width', 1.5).attr('stroke-linecap', 'round')
      .attr('filter', 'url(#gaugeGlow)');
    g.append('circle').attr('r', 3).attr('fill', 'var(--accent)').attr('filter', 'url(#gaugeGlow)');

  }, [speed, history, maxSpeed]);

  return <svg ref={svgRef} viewBox="0 0 220 140" className="w-full h-auto" />;
}
