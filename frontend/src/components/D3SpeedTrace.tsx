/**
 * Futuristic speed trace — glowing line with gradient fill and animated endpoint
 */
import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface Props {
  data: { t: number; ver: number; ham: number }[];
}

export function D3SpeedTrace({ data }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.length < 3) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const w = 440, h = 90, m = { t: 4, r: 4, b: 14, l: 24 };
    const iw = w - m.l - m.r, ih = h - m.t - m.b;

    const defs = svg.append('defs');
    // Glow
    const glow = defs.append('filter').attr('id', 'lineGlow');
    glow.append('feGaussianBlur').attr('stdDeviation', '2').attr('result', 'blur');
    glow.append('feMerge').selectAll('feMergeNode').data(['blur', 'SourceGraphic']).enter().append('feMergeNode').attr('in', (d: string) => d);
    // Gradient fill
    const grad = defs.append('linearGradient').attr('id', 'traceFill').attr('x1', '0').attr('y1', '0').attr('x2', '0').attr('y2', '1');
    grad.append('stop').attr('offset', '0%').attr('stop-color', '#3b82f6').attr('stop-opacity', '0.25');
    grad.append('stop').attr('offset', '100%').attr('stop-color', '#3b82f6').attr('stop-opacity', '0');
    // Scanline effect
    const pattern = defs.append('pattern').attr('id', 'scanlines').attr('width', '4').attr('height', '4').attr('patternUnits', 'userSpaceOnUse');
    pattern.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 4).attr('y2', 0).attr('stroke', 'rgba(59,130,246,0.03)').attr('stroke-width', '1');

    const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);

    const x = d3.scaleLinear().domain([0, data.length - 1]).range([0, iw]);
    const y = d3.scaleLinear().domain([0, 320]).range([ih, 0]);

    // Subtle grid
    [80, 160, 240, 320].forEach(v => {
      g.append('line').attr('x1', 0).attr('x2', iw).attr('y1', y(v)).attr('y2', y(v))
        .attr('stroke', 'var(--border)').attr('stroke-width', 0.3).attr('stroke-dasharray', '2,3');
    });
    // Y labels
    [0, 160, 320].forEach(v => {
      g.append('text').attr('x', -4).attr('y', y(v)).attr('text-anchor', 'end').attr('dominant-baseline', 'middle')
        .attr('fill', 'var(--text-muted)').attr('font-size', '7px').attr('font-family', 'JetBrains Mono').text(v);
    });

    // Scanline overlay
    g.append('rect').attr('width', iw).attr('height', ih).attr('fill', 'url(#scanlines)');

    // Area fill
    const area = d3.area<typeof data[0]>().x((_, i) => x(i)).y0(ih).y1(d => y(d.ver)).curve(d3.curveCatmullRom);
    g.append('path').datum(data).attr('d', area).attr('fill', 'url(#traceFill)');

    // Main line with glow
    const line = d3.line<typeof data[0]>().x((_, i) => x(i)).y(d => y(d.ver)).curve(d3.curveCatmullRom);
    g.append('path').datum(data).attr('d', line)
      .attr('fill', 'none').attr('stroke', '#3b82f6').attr('stroke-width', 2).attr('filter', 'url(#lineGlow)');

    // Endpoint pulse
    const last = data[data.length - 1];
    g.append('circle').attr('cx', x(data.length - 1)).attr('cy', y(last.ver)).attr('r', 4)
      .attr('fill', '#3b82f6').attr('filter', 'url(#lineGlow)');
    g.append('circle').attr('cx', x(data.length - 1)).attr('cy', y(last.ver)).attr('r', 7)
      .attr('fill', 'none').attr('stroke', '#3b82f6').attr('stroke-width', 0.5).attr('opacity', 0.4);

  }, [data]);

  return <svg ref={svgRef} viewBox="0 0 440 90" className="w-full h-auto" preserveAspectRatio="xMidYMid meet" />;
}
