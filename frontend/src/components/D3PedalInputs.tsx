/**
 * Futuristic pedal inputs — filled area with glow lines and distinct zones
 */
import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface Props {
  data: { t: number; throttle: number; brake: number }[];
}

export function D3PedalInputs({ data }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.length < 3) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const w = 440, h = 65, m = { t: 2, r: 4, b: 2, l: 4 };
    const iw = w - m.l - m.r, ih = h - m.t - m.b;

    const defs = svg.append('defs');
    const glow = defs.append('filter').attr('id', 'pedalGlow');
    glow.append('feGaussianBlur').attr('stdDeviation', '1.5').attr('result', 'blur');
    glow.append('feMerge').selectAll('feMergeNode').data(['blur', 'SourceGraphic']).enter().append('feMergeNode').attr('in', (d: string) => d);

    const thGrad = defs.append('linearGradient').attr('id', 'thFill2').attr('x1', '0').attr('y1', '0').attr('x2', '0').attr('y2', '1');
    thGrad.append('stop').attr('offset', '0%').attr('stop-color', '#10b981').attr('stop-opacity', '0.3');
    thGrad.append('stop').attr('offset', '100%').attr('stop-color', '#10b981').attr('stop-opacity', '0');
    const brGrad = defs.append('linearGradient').attr('id', 'brFill2').attr('x1', '0').attr('y1', '0').attr('x2', '0').attr('y2', '1');
    brGrad.append('stop').attr('offset', '0%').attr('stop-color', '#ef4444').attr('stop-opacity', '0.25');
    brGrad.append('stop').attr('offset', '100%').attr('stop-color', '#ef4444').attr('stop-opacity', '0');

    const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);
    const x = d3.scaleLinear().domain([0, data.length - 1]).range([0, iw]);
    const y = d3.scaleLinear().domain([0, 100]).range([ih, 0]);

    // Center line
    g.append('line').attr('x1', 0).attr('x2', iw).attr('y1', y(50)).attr('y2', y(50))
      .attr('stroke', 'var(--border)').attr('stroke-width', 0.3).attr('stroke-dasharray', '2,4');

    // Throttle
    const thArea = d3.area<typeof data[0]>().x((_, i) => x(i)).y0(ih).y1(d => y(d.throttle)).curve(d3.curveCatmullRom);
    g.append('path').datum(data).attr('d', thArea).attr('fill', 'url(#thFill2)');
    const thLine = d3.line<typeof data[0]>().x((_, i) => x(i)).y(d => y(d.throttle)).curve(d3.curveCatmullRom);
    g.append('path').datum(data).attr('d', thLine)
      .attr('fill', 'none').attr('stroke', '#10b981').attr('stroke-width', 1.5).attr('filter', 'url(#pedalGlow)');

    // Brake
    const brArea = d3.area<typeof data[0]>().x((_, i) => x(i)).y0(ih).y1(d => y(d.brake)).curve(d3.curveCatmullRom);
    g.append('path').datum(data).attr('d', brArea).attr('fill', 'url(#brFill2)');
    const brLine = d3.line<typeof data[0]>().x((_, i) => x(i)).y(d => y(d.brake)).curve(d3.curveCatmullRom);
    g.append('path').datum(data).attr('d', brLine)
      .attr('fill', 'none').attr('stroke', '#ef4444').attr('stroke-width', 1.5).attr('filter', 'url(#pedalGlow)');

  }, [data]);

  return <svg ref={svgRef} viewBox="0 0 440 65" className="w-full h-auto" preserveAspectRatio="xMidYMid meet" />;
}
