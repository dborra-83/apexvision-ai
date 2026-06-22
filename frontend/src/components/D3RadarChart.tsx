/**
 * Spider/Radar chart for head-to-head driver comparison
 */
import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface Props {
  driver: number[];  // normalized 0-1 values [speed, throttle, brake_inv, tires_inv, consistency]
  rival: number[];
  labels: string[];
}

export function D3RadarChart({ driver, rival, labels }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const size = 100, cx = size / 2, cy = size / 2, r = 38;
    const n = labels.length;
    const angleSlice = (2 * Math.PI) / n;

    const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

    // Grid rings
    [0.25, 0.5, 0.75, 1].forEach(level => {
      const points = Array.from({ length: n }, (_, i) => {
        const angle = i * angleSlice - Math.PI / 2;
        return `${Math.cos(angle) * r * level},${Math.sin(angle) * r * level}`;
      });
      g.append('polygon').attr('points', points.join(' '))
        .attr('fill', 'none').attr('stroke', 'var(--border)').attr('stroke-width', 0.5);
    });

    // Axes
    for (let i = 0; i < n; i++) {
      const angle = i * angleSlice - Math.PI / 2;
      g.append('line').attr('x1', 0).attr('y1', 0)
        .attr('x2', Math.cos(angle) * r).attr('y2', Math.sin(angle) * r)
        .attr('stroke', 'var(--border)').attr('stroke-width', 0.3);
      g.append('text')
        .attr('x', Math.cos(angle) * (r + 8)).attr('y', Math.sin(angle) * (r + 8))
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
        .attr('fill', 'var(--text-muted)').attr('font-size', '5px').text(labels[i]);
    }

    // Driver polygon
    const driverPoints = driver.map((v, i) => {
      const angle = i * angleSlice - Math.PI / 2;
      return `${Math.cos(angle) * r * v},${Math.sin(angle) * r * v}`;
    });
    g.append('polygon').attr('points', driverPoints.join(' '))
      .attr('fill', 'rgba(59,130,246,0.15)').attr('stroke', '#3b82f6').attr('stroke-width', 1.5);

    // Rival polygon
    const rivalPoints = rival.map((v, i) => {
      const angle = i * angleSlice - Math.PI / 2;
      return `${Math.cos(angle) * r * v},${Math.sin(angle) * r * v}`;
    });
    g.append('polygon').attr('points', rivalPoints.join(' '))
      .attr('fill', 'rgba(6,182,212,0.1)').attr('stroke', '#06b6d4').attr('stroke-width', 1).attr('stroke-dasharray', '2,1');

  }, [driver, rival, labels]);

  return <svg ref={svgRef} viewBox="0 0 100 100" className="w-full h-auto" />;
}
