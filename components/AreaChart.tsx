'use client';

import * as React from 'react';
import styles from './AreaChart.module.css';

interface DayCount {
  date: string;
  count: number;
}

interface AreaChartProps {
  data: DayCount[];
  total?: number;
  groupBy?: 'day' | 'week';
}

const PAD = { top: 10, right: 10, bottom: 40, left: 48 };
const W = 800;
const H = 180;
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;
const Y_TICKS = 4;
const X_LABELS = 7;

function weekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // back to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function groupByWeek(data: DayCount[]): DayCount[] {
  const sums: Record<string, number> = {};
  for (const { date, count } of data) {
    const key = weekStart(date);
    sums[key] = (sums[key] ?? 0) + count;
  }
  return Object.keys(sums).sort().map((date) => ({ date, count: sums[date] }));
}

function fmtDate(s: string) {
  const d = new Date(s + 'T00:00:00Z');
  return `${d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })} ${d.getUTCDate()}`;
}

function fmtNum(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export default function AreaChart({ data, total, groupBy = 'day' }: AreaChartProps) {
  if (!data.length) return null;

  const points = groupBy === 'week' ? groupByWeek(data) : data;
  const n = points.length;
  const max = Math.max(...points.map((d) => d.count), 1);

  const gap = n > 120 ? 0 : n > 40 ? 1 : 2;
  const slotW = CW / n;
  const barW = Math.max(1, slotW - gap);

  const barX = (i: number) => PAD.left + i * slotW;
  const barH = (v: number) => (v / max) * CH;
  const barY = (v: number) => PAD.top + CH - barH(v);

  const yTicks = Array.from({ length: Y_TICKS + 1 }, (_, i) =>
    Math.round((max / Y_TICKS) * i)
  );

  const labelCount = Math.min(X_LABELS, n);
  const xIndices =
    labelCount < 2
      ? [0]
      : Array.from({ length: labelCount }, (_, i) =>
          Math.round((i / (labelCount - 1)) * (n - 1))
        );

  return (
    <div className={styles.root}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg}>
        {yTicks.map((v) => {
          const ty = barY(v);
          return (
            <line
              key={v}
              x1={PAD.left}
              x2={PAD.left + CW}
              y1={ty}
              y2={ty}
              className={styles.grid}
            />
          );
        })}

        {points.map((d, i) => {
          const h = barH(d.count);
          if (h < 0.5) return null;
          return (
            <rect
              key={i}
              x={barX(i)}
              y={barY(d.count)}
              width={barW}
              height={h}
              className={styles.bar}
            />
          );
        })}

        {yTicks.map((v) => (
          <text
            key={v}
            x={PAD.left - 6}
            y={barY(v)}
            className={styles.label}
            textAnchor="end"
            dominantBaseline="middle"
          >
            {fmtNum(v)}
          </text>
        ))}

        {xIndices.map((idx) => (
          <text
            key={idx}
            x={barX(idx) + barW / 2}
            y={H - 6}
            className={styles.label}
            textAnchor="middle"
          >
            {fmtDate(points[idx].date)}
          </text>
        ))}
      </svg>

      {total !== undefined && (
        <p className={styles.total}>{total.toLocaleString()} scrobbles</p>
      )}
    </div>
  );
}
