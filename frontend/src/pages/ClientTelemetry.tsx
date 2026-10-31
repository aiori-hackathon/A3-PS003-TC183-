import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { api, ApiError, downloadText, formatBytes, PartitionPreview } from '../api/client';
import { EmptyState, LineChart, OfflineBanner, PALETTE } from '../components/charts';

const card = 'bg-surface-container-lowest p-space-lg rounded-2xl shadow-sm border border-surface-container/70';
const LEVEL_COLORS = ['#cfe5ff', '#93c5fd', '#3b82f6', '#1d4ed8', '#0b1c30'];

export const ClientTelemetry: React.FC = () => {
  const { backendOnline, simConfig, setSimConfig, activeExperiment, addToast, startExperiment, setActiveTab } = useApp();
  const [preview, setPreview] = useState<PartitionPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Record<number, boolean>>({});

  const { dataset_id, target, num_sensors, num_clients, partition, alpha, seed } = simConfig;

  useEffect(() => {
    if (backendOnline === false) return;
    let alive = true;
    setLoading(true);
    setError(null);
    const t = setTimeout(() => {
      api
        .partitionPreview({ dataset_id, target, num_sensors, num_clients, partition, alpha, seed })
        .then((p) => alive && setPreview(p))
        .catch((e) => alive && setError(e instanceof ApiError ? e.message : String(e)))
        .finally(() => alive && setLoading(false));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [dataset_id, target, num_sensors, num_clients, partition, alpha, seed, backendOnline]);

  const exportCsv = () => {
    if (!preview) return;
    const rows = ['client,num_sensors,sensors,mean,std,p95,missing_fraction,tv_distance,raw_training_bytes,' + Array.from({ length: 24 }, (_, h) => `hour_${h}`).join(',')];
    for (const c of preview.clients)
      rows.push([c.name, c.num_sensors, `"${c.sensors.join(' ')}"`, c.mean, c.std, c.p95, c.missing_fraction, c.heterogeneity_tv, c.raw_training_bytes, ...c.hourly_profile.map((v) => v ?? '')].join(','));
    downloadText(`partition_${partition}_${alpha}_seed${seed}.csv`, rows.join('\n'), 'text/csv');
    addToast('Partition Exported', 'Per-client statistics downloaded as CSV.', 'info');
  };

  const alphaSteps = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10];
  const testByClient =
    activeExperiment?.status === 'completed' &&
    activeExperiment.config.partition === partition &&
    activeExperiment.config.num_clients === num_clients &&
    activeExperiment.config.seed === seed &&
    (partition !== 'dirichlet' || activeExperiment.config.alpha === alpha)
      ? activeExperiment.metrics?.per_client_test
      : null;

  return (
    <div className="flex flex-col w-full animate-fade-in">
      <div className="w-full px-space-md lg:px-space-margin-desktop py-space-lg flex flex-col md:flex-row md:items-end justify-between gap-space-md max-w-[1720px] mx-auto">
        <div>
          <div className="flex items-center gap-space-xs text-secondary font-label-sm text-label-sm uppercase tracking-wider mb-1 font-bold">
            <span className="w-2 h-2 rounded-full bg-secondary"></span>
            <span>Client data partitioning</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight font-bold">Client Non-IID Telemetry</h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl mt-1 leading-relaxed">
            How the selected real sensors are split across clients, computed by the backend from the training period only. With the Dirichlet partition, a smaller α gives each client a more skewed mix of low- and high-traffic sensors.
          </p>
        </div>
        <div className="flex items-center gap-space-sm flex-wrap">
          <button onClick={exportCsv} disabled={!preview} className="px-space-md py-space-sm bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md rounded-xl font-bold cursor-pointer disabled:opacity-40 border border-surface-container-high">
            Export CSV
          </button>
          <button
            onClick={async () => {
              const e = await startExperiment({ start_paused: false });
              if (e) setActiveTab('federated-simulator');
            }}
            disabled={backendOnline === false}
            className="px-space-md py-space-sm bg-primary text-on-primary font-label-md text-label-md rounded-xl shadow-sm font-bold cursor-pointer disabled:opacity-40"
          >
            Train with this partition
          </button>
        </div>
      </div>

      <OfflineBanner online={backendOnline} />

      <div className="w-full px-space-md lg:px-space-margin-desktop pb-space-lg max-w-[1720px] mx-auto space-y-space-lg">
        {/* Controls */}
        <div className={`${card} grid grid-cols-1 lg:grid-cols-4 gap-space-md`}>
          <div>
            <span className="block font-label-md text-label-md font-bold text-on-surface mb-1.5">Partition strategy</span>
            <div className="grid grid-cols-3 gap-1">
              {(['dirichlet', 'iid', 'contiguous'] as const).map((p) => (
                <button key={p} onClick={() => setSimConfig({ partition: p })} className={`py-1.5 rounded-lg font-label-sm text-label-sm font-bold cursor-pointer ${partition === p ? 'bg-secondary text-on-secondary' : 'bg-surface-container text-on-surface-variant'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className={partition === 'dirichlet' ? '' : 'opacity-40 pointer-events-none'}>
            <label htmlFor="alpha" className="block font-label-md text-label-md font-bold text-on-surface mb-1.5">
              Dirichlet α: <span className="font-mono text-secondary">{alpha}</span>
            </label>
            <input
              id="alpha"
              type="range"
              min={0}
              max={alphaSteps.length - 1}
              step={1}
              value={Math.max(0, alphaSteps.indexOf(alpha))}
              onChange={(e) => setSimConfig({ alpha: alphaSteps[+e.target.value] })}
              className="w-full accent-secondary"
            />
            <div className="flex justify-between font-label-sm text-label-sm text-on-surface-variant">
              <span>0.05 (skewed)</span>
              <span>10 (near IID)</span>
            </div>
          </div>
          <label className="font-label-md text-label-md font-bold text-on-surface">
            Clients: <span className="font-mono text-secondary">{num_clients}</span>
            <input type="range" min={2} max={Math.min(10, num_sensors)} value={num_clients} onChange={(e) => setSimConfig({ num_clients: +e.target.value })} className="w-full accent-secondary" />
          </label>
          <div>
            <span className="block font-label-md text-label-md font-bold text-on-surface mb-1.5">Seed</span>
            <div className="flex gap-1">
              {[42, 108, 999].map((s) => (
                <button key={s} onClick={() => setSimConfig({ seed: s })} className={`flex-1 py-1.5 rounded-lg font-label-sm text-label-sm font-mono font-bold cursor-pointer ${seed === s ? 'bg-secondary text-on-secondary' : 'bg-surface-container text-on-surface-variant'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="p-space-sm rounded-xl bg-error/10 border border-error/30 text-error font-label-md text-label-md" role="alert">
            {error}
          </div>
        )}

        {!preview ? (
          <EmptyState icon="hub" title={loading ? 'Computing partition…' : 'No partition loaded'}>
            {backendOnline === false ? 'The backend is offline.' : 'Partition statistics are computed from the dataset by the backend.'}
          </EmptyState>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-space-md">
              <div className={card}>
                <span className="font-label-sm text-label-sm uppercase font-bold text-on-surface-variant">Heterogeneity (mean TV distance)</span>
                <div className="font-headline-lg text-headline-lg font-bold font-mono text-on-surface mt-2">{preview.heterogeneity.mean.toFixed(3)}</div>
                <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">0 = every client has the global traffic-level mix; 1 = completely different.</p>
              </div>
              <div className={card}>
                <span className="font-label-sm text-label-sm uppercase font-bold text-on-surface-variant">Sensors / clients</span>
                <div className="font-headline-lg text-headline-lg font-bold font-mono text-on-surface mt-2">
                  {preview.clients.reduce((a, c) => a + c.num_sensors, 0)} / {preview.clients.length}
                </div>
                <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">
                  Sizes: {preview.clients.map((c) => c.num_sensors).join(', ')}
                </p>
              </div>
              <div className={card}>
                <span className="font-label-sm text-label-sm uppercase font-bold text-on-surface-variant">Training period</span>
                <div className="font-headline-sm text-headline-sm font-bold font-mono text-on-surface mt-2">
                  {preview.splits?.train.start.slice(0, 10)} → {preview.splits?.train.end.slice(0, 10)}
                </div>
                <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">Statistics use training data only (no test leakage).</p>
              </div>
              <div className={card}>
                <span className="font-label-sm text-label-sm uppercase font-bold text-on-surface-variant">Raw data that stays local</span>
                <div className="font-headline-lg text-headline-lg font-bold font-mono text-on-surface mt-2">{formatBytes(preview.clients.reduce((a, c) => a + c.raw_training_bytes, 0))}</div>
                <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">float32, all dataset features, training period.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg">
              <div className={`xl:col-span-7 ${card}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 pb-space-sm border-b border-surface-container mb-space-sm">
                  <div>
                    <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">Average daily profile per client</h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">Mean {preview.target} by hour of day ({preview.unit}), zero readings excluded.</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {preview.clients.map((c, i) => (
                      <button
                        key={c.client_id}
                        onClick={() => setHidden((h) => ({ ...h, [c.client_id]: !h[c.client_id] }))}
                        className={`px-2 py-0.5 rounded-lg font-label-sm text-label-sm font-bold cursor-pointer border ${hidden[c.client_id] ? 'opacity-40 border-surface-container' : 'border-transparent'}`}
                        style={{ background: `${PALETTE[i % PALETTE.length]}22`, color: PALETTE[i % PALETTE.length] }}
                        aria-pressed={!hidden[c.client_id]}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
                <LineChart
                  series={preview.clients
                    .map((c, i) => ({ c, i }))
                    .filter(({ c }) => !hidden[c.client_id])
                    .map(({ c, i }) => ({ name: c.name, color: PALETTE[i % PALETTE.length], points: c.hourly_profile.map((v, h) => ({ x: h, y: v })) }))}
                  xLabel="Hour of day"
                  yLabel={preview.unit}
                  xTicks={[0, 3, 6, 9, 12, 15, 18, 21, 23]}
                  xFormat={(v) => `${v}:00`}
                />
              </div>
              <div className={`xl:col-span-5 ${card}`}>
                <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">Traffic-level mix per client</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-sm">{preview.level_bins_definition}.</p>
                <div className="space-y-2">
                  {preview.clients.map((c) => {
                    const total = c.level_histogram.reduce((a, b) => a + b, 0) || 1;
                    return (
                      <div key={c.client_id}>
                        <div className="flex justify-between font-label-sm text-label-sm">
                          <span className="font-bold text-on-surface">{c.name}</span>
                          <span className="text-on-surface-variant font-mono">TV {c.heterogeneity_tv.toFixed(2)}</span>
                        </div>
                        <div className="flex h-5 rounded-lg overflow-hidden mt-0.5">
                          {c.level_histogram.map((n, b) =>
                            n ? (
                              <div key={b} style={{ width: `${(n / total) * 100}%`, background: LEVEL_COLORS[b] }} className="flex items-center justify-center text-[10px] font-bold" title={`Level ${b}: ${n} sensor(s)`}>
                                <span className={b >= 3 ? 'text-white' : 'text-primary'}>{n}</span>
                              </div>
                            ) : null
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2 mt-space-sm font-label-sm text-label-sm text-on-surface-variant items-center flex-wrap">
                  {LEVEL_COLORS.map((c, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded" style={{ background: c }}></span>
                      {i === 0 ? 'lowest' : i === 4 ? 'highest' : `level ${i}`}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className={card}>
              <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface mb-space-sm">Per-client statistics</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                      {['Client', 'Sensors', `Mean (${preview.unit})`, 'Std', 'P95', 'Missing', 'TV distance', 'Raw kept local', ...(testByClient ? ['Test MAE (active run)'] : [])].map((h) => (
                        <th key={h} className="py-space-sm px-space-md font-bold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="font-label-md text-label-md text-on-surface divide-y divide-surface-container font-mono">
                    {preview.clients.map((c) => (
                      <tr key={c.client_id}>
                        <td className="py-1.5 px-space-md font-bold">{c.name}</td>
                        <td className="py-1.5 px-space-md" title={c.sensors.join(', ')}>{c.num_sensors} ({c.sensors.slice(0, 4).join(', ')}{c.sensors.length > 4 ? '…' : ''})</td>
                        <td className="py-1.5 px-space-md">{c.mean.toFixed(1)}</td>
                        <td className="py-1.5 px-space-md">{c.std.toFixed(1)}</td>
                        <td className="py-1.5 px-space-md">{c.p95.toFixed(1)}</td>
                        <td className="py-1.5 px-space-md">{(c.missing_fraction * 100).toFixed(2)}%</td>
                        <td className="py-1.5 px-space-md">{c.heterogeneity_tv.toFixed(3)}</td>
                        <td className="py-1.5 px-space-md">{formatBytes(c.raw_training_bytes)}</td>
                        {testByClient && <td className="py-1.5 px-space-md">{testByClient.find((t) => t.client_id === c.client_id)?.mae.toFixed(2) ?? '—'}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
