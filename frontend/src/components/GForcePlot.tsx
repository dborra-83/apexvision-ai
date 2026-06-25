/**
 * G-Force plot with trail history — D3
 */
import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface Props {
  gLat: number;
  gLong: number;
  history: { lat: number; long: number }[];
}

export function GForcePlot({ gLat, gLong, history }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const size = 100, cx = size / 2, cy = size / 2, maxG = 3.5;
    const scale = (g: number) => Math.max(-(size/2 - 12), Math.min(size/2 - 12, (g / maxG) * (size / 2 - 12)));

    const defs = svg.append('defs');
    const glow = defs.append('filter').attr('id', 'gGlow');
    glow.append('feGaussianBlur').attr('stdDeviation', '2').attr('result', 'blur');
    glow.append('feMerge').selectAll('feMergeNode').data(['blur', 'SourceGraphic']).enter().append('feMergeNode').attr('in', (d: string) => d);

    const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

    // Rings
    [1, 2, 3].forEach(r => {
      g.append('circle').attr('r', scale(r)).attr('fill', 'none')
        .attr('stroke', 'var(--border)').attr('stroke-width', 0.5).attr('stroke-dasharray', r === 3 ? '2,2' : 'none');
    });
    // Crosshair
    g.append('line').attr('x1', -scale(maxG)).attr('x2', scale(maxG)).attr('y1', 0).attr('y2', 0).attr('stroke', 'var(--border)').attr('stroke-width', 0.3);
    g.append('line').attr('x1', 0).attr('x2', 0).attr('y1', -scale(maxG)).attr('y2', scale(maxG)).attr('stroke', 'var(--border)').attr('stroke-width', 0.3);

    // Labels
    g.append('text').attr('x', 0).attr('y', -scale(maxG) - 3).attr('text-anchor', 'middle').attr('fill', 'var(--text-muted)').attr('font-size', '5px').text('ACC');
    g.append('text').attr('x', 0).attr('y', scale(maxG) + 7).attr('text-anchor', 'middle').attr('fill', 'var(--text-muted)').attr('font-size', '5px').text('BRK');
    g.append('text').attr('x', -scale(maxG) - 3).attr('y', 2).attr('text-anchor', 'end').attr('fill', 'var(--text-muted)').attr('font-size', '5px').text('L');
    g.append('text').attr('x', scale(maxG) + 3).attr('y', 2).attr('text-anchor', 'start').attr('fill', 'var(--text-muted)').attr('font-size', '5px').text('R');

    // Trail
    if (history.length > 2) {
      const trail = history.slice(-30);
      trail.forEach((p, i) => {
        const opacity = (i / trail.length) * 0.4;
        g.append('circle')
          .attr('cx', scale(p.lat))
          .attr('cy', scale(p.long))
          .attr('r', 1.2)
          .attr('fill', 'var(--accent)')
          .attr('opacity', opacity);
      });
    }

    // Current dot
    const dotX = scale(gLat);
    const dotY = scale(gLong);  // Positive gLong = acceleration = goes UP visually
    g.append('circle').attr('cx', dotX).attr('cy', dotY).attr('r', 4)
      .attr('fill', 'var(--accent)').attr('filter', 'url(#gGlow)');

  }, [gLat, gLong, history]);

  return <svg ref={svgRef} viewBox="0 0 100 100" className="w-full h-auto" />;
}
