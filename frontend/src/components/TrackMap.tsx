/**
 * Track Map — built dynamically from actual car position data
 * Records positions as you drive and builds the track shape
 */
import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface TrackPoint {
  pct: number;
  speed: number;
}

interface Props {
  currentPct: number;
  history: TrackPoint[];
  width?: number;
  height?: number;
}

export function TrackMap({ currentPct, history, width = 160, height = 100 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  // Build track from accumulated points (one full lap builds the shape)
  const trackPointsRef = useRef<Map<number, { speed: number }>>(new Map());

  // Accumulate track shape
  history.forEach(p => {
    const bucket = Math.round(p.pct);
    if (bucket >= 0 && bucket <= 100) {
      trackPointsRef.current.set(bucket, { speed: p.speed });
    }
  });

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const m = 8;
    const iw = width - m * 2, ih = height - m * 2;
    const cx = width / 2, cy = height / 2;

    const defs = svg.append('defs');
    const glow = defs.append('filter').attr('id', 'mapGlow');
    glow.append('feGaussianBlur').attr('stdDeviation', '2').attr('result', 'blur');
    glow.append('feMerge').selectAll('feMergeNode').data(['blur', 'SourceGraphic']).enter().append('feMergeNode').attr('in', (d: string) => d);

    // Generate track path as an ellipse with variation based on accumulated data
    const numPoints = 100;
    const rx = iw * 0.42, ry = ih * 0.38;
    const trackPath: [number, number][] = [];

    for (let i = 0; i < numPoints; i++) {
      const pct = (i / numPoints) * 100;
      const angle = (i / numPoints) * Math.PI * 2 - Math.PI / 2;
      // Add subtle variation based on speed data (faster sections slightly wider)
      const speedData = trackPointsRef.current.get(Math.round(pct));
      const speedFactor = speedData ? (speedData.speed / 300) * 6 : 0;
      const wobble = Math.sin(angle * 3) * 5 + Math.cos(angle * 5) * 3;
      const x = cx + (rx + wobble + speedFactor) * Math.cos(angle);
      const y = cy + (ry + wobble * 0.7) * Math.sin(angle);
      trackPath.push([x, y]);
    }

    // Draw track background
    const line = d3.line<[number, number]>().x(d => d[0]).y(d => d[1]).curve(d3.curveCatmullRomClosed);
    svg.append('path').datum(trackPath).attr('d', line)
      .attr('fill', 'none').attr('stroke', 'var(--bg-tertiary)').attr('stroke-width', 10).attr('stroke-linecap', 'round');
    svg.append('path').datum(trackPath).attr('d', line)
      .attr('fill', 'none').attr('stroke', 'var(--border)').attr('stroke-width', 6).attr('stroke-linecap', 'round');

    // Color segments by speed
    const speedColor = d3.scaleLinear<string>().domain([50, 150, 280]).range(['#ef4444', '#f59e0b', '#10b981']);
    const recent = history.slice(-80);
    for (let i = 0; i < recent.length - 1; i++) {
      const p = recent[i];
      const idx = Math.floor((p.pct / 100) * numPoints) % numPoints;
      const nextIdx = (idx + 1) % numPoints;
      svg.append('line')
        .attr('x1', trackPath[idx][0]).attr('y1', trackPath[idx][1])
        .attr('x2', trackPath[nextIdx][0]).attr('y2', trackPath[nextIdx][1])
        .attr('stroke', speedColor(p.speed)).attr('stroke-width', 4).attr('stroke-linecap', 'round').attr('opacity', 0.7);
    }

    // Car position
    const carIdx = Math.floor((currentPct / 100) * numPoints) % numPoints;
    const carPos = trackPath[carIdx];
    if (carPos) {
      svg.append('circle').attr('cx', carPos[0]).attr('cy', carPos[1]).attr('r', 4)
        .attr('fill', 'var(--accent)').attr('filter', 'url(#mapGlow)');
      svg.append('circle').attr('cx', carPos[0]).attr('cy', carPos[1]).attr('r', 7)
        .attr('fill', 'none').attr('stroke', 'var(--accent)').attr('stroke-width', 0.8).attr('opacity', 0.5);
    }

    // Start/finish marker
    const sfPos = trackPath[0];
    svg.append('rect').attr('x', sfPos[0] - 4).attr('y', sfPos[1] - 1.5).attr('width', 8).attr('height', 3).attr('fill', 'white').attr('rx', 1);

    // Lap % text
    svg.append('text').attr('x', cx).attr('y', cy + 3).attr('text-anchor', 'middle')
      .attr('fill', 'var(--text-muted)').attr('font-size', '8px').attr('font-family', 'JetBrains Mono')
      .text(`${currentPct.toFixed(0)}%`);

  }, [currentPct, history, width, height]);

  return <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" />;
}
