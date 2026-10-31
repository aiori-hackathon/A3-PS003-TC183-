import React, { useState } from 'react';

export const PALETTE = ['#006398', '#009668', '#ba1a1a', '#7c3aed', '#d97706', '#0b1c30', '#0284c7', '#db2777'];

export interface Series {
  name: string;
  color?: string;
  dashed?: boolean;
  width?: number;
  points: { x: number; y: number | null }[];
}

function niceTicks(min: number, max: number, count = 5): number[] {
  if (!isFinite(min) || !isFinite(max)) return [];
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    min -= pad;
    max += pad;
  }
  const span = max - min;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.5; v += step) ticks.push(Number(v.toFixed(10)));
  return ticks;
}

const defaultFmt = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k`;
  if (a >= 10 || v === 0) return v.toFixed(0);
  return v.toFixed(a >= 1 ? 1 : 2);
};

interface LineChartProps {
  series: Series[];
  height?: number;
  xLabel?: string;
  yLabel?: string;
  xFormat?: (v: number) => string;
  yFormat?: (v: number) => string;
  yMin?: number;
  xTicks?: number[];
  cursorX?: number | null;
  emptyText?: string;
  ariaLabel?: string;
  showLegend?: boolean;
}

export const LineChart: React.FC<LineChartProps> = ({
  series,
  height = 240,
  xLabel,
  yLabel,
  xFormat = defaultFmt,
  yFormat = defaultFmt,
  yMin,
  xTicks,
  cursorX,
  emptyText = 'No data yet',
  ariaLabel = 'Line chart',
  showLegend = true,
}) => {
  const W = 600;
  const H = height;
  const pad = { l: 52, r: 14, t: 14, b: xLabel ? 38 : 26 };
  const [hover, setHover] = useState<number | null>(null);

  const all = series.flatMap((s) => s.points.filter((p) => p.y !== null && isFinite(p.y as number)));
  const { xs, ys, xmin, xmax, ymin, ymax } = (() => {
    if (!all.length) return { xs: [], ys: [], xmin: 0, xmax: 1, ymin: 0, ymax: 1 };
    const xv = all.map((p) => p.x);
    const yv = all.map((p) => p.y as number);
    let lo = yMin !== undefined ? Math.min(yMin, ...yv) : Math.min(...yv);
    let hi = Math.max(...yv);
    if (yMin === undefined) {
      const padY = (hi - lo) * 0.08 || Math.abs(hi) * 0.1 || 1;
      lo -= padY;
      hi += padY;
    }
    const yt = niceTicks(lo, hi);
    const xlo = Math.min(...xv);
    const xhi = Math.max(...xv);
    return {
      xs: xTicks ?? niceTicks(xlo, xhi, 6).filter((t) => t >= xlo && t <= xhi),
      ys: yt,
      xmin: xlo,
      xmax: xhi === xlo ? xlo + 1 : xhi,
      ymin: yt[0],
      ymax: yt[yt.length - 1],
    };
  })();

  if (!all.length) {
    return (
      <div className="w-full flex items-center justify-center text-on-surface-variant font-label-sm text-label-sm bg-surface-container-low/60 rounded-xl border border-dashed border-surface-container-high" style={{ height }}>
        {emptyText}
      </div>
    );
  }

  const sx = (x: number) => pad.l + ((x - xmin) / (xmax - xmin)) * (W - pad.l - pad.r);
  const sy = (y: number) => pad.t + (1 - (y - ymin) / (ymax - ymin || 1)) * (H - pad.t - pad.b);

  const path = (pts: Series['points']) => {
    let d = '';
    let pen = false;
    for (const p of pts) {
      if (p.y === null || !isFinite(p.y)) {
        pen = false;
        continue;
      }
      d += `${pen ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)} `;
      pen = true;
    }
    return d;
  };

  // Hover: nearest x of the first series with data
  const ref = series.find((s) => s.points.length) ?? series[0];
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bd = Infinity;
    ref.points.forEach((p, i) => {
      const d = Math.abs(sx(p.x) - x);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    setHover(best);
  };
  const hx = hover !== null ? ref.points[hover]?.x : null;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} role="img" aria-label={ariaLabel} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {ys.map((t) => (
          <g key={`y${t}`}>
            <line x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} stroke="#c6c6cd" strokeOpacity="0.45" strokeDasharray="3,3" />
            <text x={pad.l - 6} y={sy(t) + 3} textAnchor="end" className="fill-current text-on-surface-variant" fontSize="10">
              {yFormat(t)}
            </text>
          </g>
        ))}
        {xs.map((t) => (
          <text key={`x${t}`} x={sx(t)} y={H - pad.b + 14} textAnchor="middle" className="fill-current text-on-surface-variant" fontSize="10">
            {xFormat(t)}
          </text>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="#76777d" strokeOpacity="0.6" />
        {xLabel && (
          <text x={(pad.l + W - pad.r) / 2} y={H - 4} textAnchor="middle" className="fill-current text-on-surface-variant" fontSize="10">
            {xLabel}
          </text>
        )}
        {yLabel && (
          <text x={12} y={(pad.t + H - pad.b) / 2} textAnchor="middle" transform={`rotate(-90 12 ${(pad.t + H - pad.b) / 2})`} className="fill-current text-on-surface-variant" fontSize="10">
            {yLabel}
          </text>
        )}
        {series.map((s, i) => (
          <path
            key={s.name}
            d={path(s.points)}
            fill="none"
            stroke={s.color ?? PALETTE[i % PALETTE.length]}
            strokeWidth={s.width ?? 2}
            strokeDasharray={s.dashed ? '5,4' : undefined}
            strokeLinejoin="round"
          />
        ))}
        {series.map((s, i) =>
          s.points.length <= 40
            ? s.points.map((p, j) =>
                p.y !== null ? <circle key={`${s.name}-${j}`} cx={sx(p.x)} cy={sy(p.y)} r={2.5} fill={s.color ?? PALETTE[i % PALETTE.length]} /> : null
              )
            : null
        )}
        {cursorX !== undefined && cursorX !== null && cursorX >= xmin && cursorX <= xmax && (
          <line x1={sx(cursorX)} x2={sx(cursorX)} y1={pad.t} y2={H - pad.b} stroke="#ba1a1a" strokeDasharray="2,2" strokeWidth="1.2" />
        )}
        {hx !== null && hx !== undefined && (
          <line x1={sx(hx)} x2={sx(hx)} y1={pad.t} y2={H - pad.b} stroke="#76777d" strokeOpacity="0.6" />
        )}
      </svg>
      <div className="flex flex-wrap items-center justify-between gap-2 mt-1 min-h-[20px]">
        {showLegend && (
          <div className="flex flex-wrap gap-3 font-label-sm text-label-sm text-on-surface-variant">
            {series.map((s, i) => (
              <span key={s.name} className="flex items-center gap-1.5">
                <svg width="18" height="6" aria-hidden>
                  <line x1="0" x2="18" y1="3" y2="3" stroke={s.color ?? PALETTE[i % PALETTE.length]} strokeWidth="2.5" strokeDasharray={s.dashed ? '4,3' : undefined} />
                </svg>
                {s.name}
              </span>
            ))}
          </div>
        )}
        {hx !== null && hx !== undefined && (
          <div className="font-mono text-[11px] text-on-surface bg-surface-container px-2 py-0.5 rounded-lg">
            {xFormat(hx)}:{' '}
            {series
              .map((s) => {
                const p = s.points.find((q) => q.x === hx);
                return p && p.y !== null ? `${s.name} ${yFormat(p.y)}` : null;
              })
              .filter(Boolean)
              .join(' · ')}
          </div>
        )}
      </div>
    </div>
  );
};

export interface ScatterPoint {
  x: number;
  y: number;
  label: string;
  color?: string;
  highlight?: boolean;
}

export const ScatterChart: React.FC<{
  points: ScatterPoint[];
  height?: number;
  xLabel: string;
  yLabel: string;
  xFormat?: (v: number) => string;
  yFormat?: (v: number) => string;
  logX?: boolean;
  emptyText?: string;
}> = ({ points, height = 280, xLabel, yLabel, xFormat = defaultFmt, yFormat = defaultFmt, logX = false, emptyText = 'No completed experiments yet' }) => {
  const W = 600;
  const H = height;
  const pad = { l: 56, r: 20, t: 16, b: 40 };
  if (!points.length) {
    return (
      <div className="w-full flex items-center justify-center text-on-surface-variant font-label-sm text-label-sm bg-surface-container-low/60 rounded-xl border border-dashed border-surface-container-high" style={{ height }}>
        {emptyText}
      </div>
    );
  }
  const tx = (v: number) => (logX ? Math.log10(Math.max(v, 1)) : v);
  const xv = points.map((p) => tx(p.x));
  const yv = points.map((p) => p.y);
  let xlo = Math.min(...xv);
  let xhi = Math.max(...xv);
  const xpad = (xhi - xlo) * 0.12 || 0.5;
  xlo -= xpad;
  xhi += xpad;
  const yt = niceTicks(Math.min(...yv) * 0.95, Math.max(...yv) * 1.05);
  const ylo = yt[0];
  const yhi = yt[yt.length - 1];
  const sx = (v: number) => pad.l + ((tx(v) - xlo) / (xhi - xlo)) * (W - pad.l - pad.r);
  const sy = (v: number) => pad.t + (1 - (v - ylo) / (yhi - ylo || 1)) * (H - pad.t - pad.b);
  const xticks = logX
    ? Array.from({ length: Math.floor(xhi) - Math.ceil(xlo) + 1 }, (_, i) => Math.pow(10, Math.ceil(xlo) + i))
    : niceTicks(xlo, xhi, 5).filter((t) => t >= xlo && t <= xhi);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} role="img" aria-label={`${yLabel} versus ${xLabel}`}>
      {yt.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} stroke="#c6c6cd" strokeOpacity="0.45" strokeDasharray="3,3" />
          <text x={pad.l - 6} y={sy(t) + 3} textAnchor="end" fontSize="10" className="fill-current text-on-surface-variant">
            {yFormat(t)}
          </text>
        </g>
      ))}
      {xticks.map((t) => (
        <text key={t} x={sx(t)} y={H - pad.b + 14} textAnchor="middle" fontSize="10" className="fill-current text-on-surface-variant">
          {xFormat(t)}
        </text>
      ))}
      <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="#76777d" strokeOpacity="0.6" />
      <text x={(pad.l + W - pad.r) / 2} y={H - 6} textAnchor="middle" fontSize="10" className="fill-current text-on-surface-variant">
        {xLabel}
      </text>
      <text x={12} y={(pad.t + H - pad.b) / 2} textAnchor="middle" transform={`rotate(-90 12 ${(pad.t + H - pad.b) / 2})`} fontSize="10" className="fill-current text-on-surface-variant">
        {yLabel}
      </text>
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={sx(p.x)} cy={sy(p.y)} r={p.highlight ? 7 : 5.5} fill={p.color ?? PALETTE[i % PALETTE.length]} stroke="#fff" strokeWidth="2">
            <title>{`${p.label}: ${xFormat(p.x)}, ${yFormat(p.y)}`}</title>
          </circle>
          <text x={sx(p.x) + 9} y={sy(p.y) - 7} fontSize="10" fontWeight={600} className="fill-current text-on-surface">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
};

/** Placeholder shown where data requires a backend result that does not exist yet. */
export const EmptyState: React.FC<{ icon?: string; title: string; children?: React.ReactNode; action?: React.ReactNode }> = ({ icon = 'hourglass_empty', title, children, action }) => (
  <div className="flex flex-col items-center justify-center text-center gap-2 py-8 px-4 bg-surface-container-low/60 rounded-xl border border-dashed border-surface-container-high">
    <span className="material-symbols-outlined text-[28px] text-on-surface-variant">{icon}</span>
    <span className="font-label-md text-label-md font-bold text-on-surface">{title}</span>
    {children && <div className="font-body-sm text-body-sm text-on-surface-variant max-w-lg">{children}</div>}
    {action}
  </div>
);

export const StatusBadge: React.FC<{ status: string; paused?: boolean }> = ({ status, paused }) => {
  const map: Record<string, { cls: string; icon: string; label: string }> = {
    queued: { cls: 'bg-surface-container text-on-surface-variant', icon: 'schedule', label: 'Queued' },
    running: { cls: 'bg-secondary/15 text-secondary', icon: 'autorenew', label: 'Running' },
    completed: { cls: 'bg-on-tertiary-container/15 text-on-tertiary-container', icon: 'check_circle', label: 'Completed' },
    failed: { cls: 'bg-error/15 text-error', icon: 'error', label: 'Failed' },
    cancelled: { cls: 'bg-amber-500/15 text-amber-700', icon: 'cancel', label: 'Cancelled' },
    ready: { cls: 'bg-surface-container text-on-surface-variant', icon: 'radio_button_unchecked', label: 'Ready' },
  };
  const m = map[status] ?? map.ready;
  const label = paused && (status === 'running' || status === 'queued') ? 'Paused' : m.label;
  const icon = paused && (status === 'running' || status === 'queued') ? 'pause_circle' : m.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-label-sm text-label-sm font-bold ${m.cls}`}>
      <span className={`material-symbols-outlined text-[14px] ${status === 'running' && !paused ? 'animate-spin' : ''}`} style={{ animationDuration: '2s' }}>
        {icon}
      </span>
      {label}
    </span>
  );
};

export const OfflineBanner: React.FC<{ online: boolean | null }> = ({ online }) =>
  online === false ? (
    <div className="mx-space-md lg:mx-space-margin-desktop mt-space-md p-space-sm rounded-xl bg-error/10 border border-error/30 text-error font-label-md text-label-md flex items-center gap-2" role="alert">
      <span className="material-symbols-outlined text-[18px]">cloud_off</span>
      <span>
        Backend offline. Start it with <code className="font-mono bg-error/10 px-1 rounded">cd backend &amp;&amp; ./run.sh</code>. No metrics are shown until results come from the backend.
      </span>
    </div>
  ) : null;
