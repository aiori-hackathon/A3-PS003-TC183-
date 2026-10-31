import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { api, downloadText, Experiment, fmt, formatBytes, Predictions } from '../api/client';
import { EmptyState, LineChart, OfflineBanner, PALETTE } from '../components/charts';

const card = 'bg-surface-container-lowest p-space-lg rounded-2xl shadow-sm border border-surface-container/70';
const SEEDS = [42, 108, 999];

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const std = (xs: number[]) => (xs.length > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean(xs)) ** 2, 0) / (xs.length - 1)) : 0);

/** Baseline FedAvg (fp32, full participation, FedAvg) or centralized run. */
const isBaselineFed = (e: Experiment) =>
  e.mode === 'federated' && e.config.uplink_encoding === 'fp32' && e.config.downlink_encoding === 'fp32' && e.config.client_fraction === 1 && e.config.aggregation === 'fedavg' && e.config.client_dropout_prob === 0;

const protoKey = (e: Experiment) => {
  const c = e.config;
  return [c.dataset_id, c.target, c.horizon, c.input_len, c.num_sensors, c.train_frac, c.val_frac, c.num_clients, c.partition, c.alpha, c.rounds, c.local_epochs, c.max_local_steps].join('|');
};

export const CentralizedBenchmark: React.FC = () => {
  const { backendOnline, experiments, simConfig, addToast, setActiveTab } = useApp();
  const [metric, setMetric] = useState<'mae' | 'rmse' | 'bytes'>('mae');
  const [seedView, setSeedView] = useState<number>(42);
  const [horizonStep, setHorizonStep] = useState(3);
  const [preds, setPreds] = useState<{ fed: Predictions | null; cen: Predictions | null }>({ fed: null, cen: null });
  const [units, setUnits] = useState(25);
  const [days, setDays] = useState(30);

  // Group completed baseline runs by protocol; choose the protocol group with the most seeds covered.
  const groups = useMemo(() => {
    const done = experiments.filter((e) => e.status === 'completed' && e.metrics && (e.mode === 'centralized' || isBaselineFed(e)));
    const by: Record<string, { fed: Record<number, Experiment>; cen: Record<number, Experiment> }> = {};
    for (const e of done) {
      const k = protoKey(e);
      by[k] ??= { fed: {}, cen: {} };
      const slot = e.mode === 'centralized' ? by[k].cen : by[k].fed;
      if (!slot[e.config.seed]) slot[e.config.seed] = e; // newest first
    }
    return Object.entries(by)
      .map(([k, v]) => ({ key: k, ...v, pairs: Object.keys(v.fed).filter((s) => v.cen[+s]).map(Number) }))
      .sort((a, b) => b.pairs.length - a.pairs.length || Object.keys(b.fed).length - Object.keys(a.fed).length);
  }, [experiments]);
  const [groupKey, setGroupKey] = useState<string | null>(null);
  const group = groups.find((g) => g.key === groupKey) ?? groups[0];

  const seedsWithPairs = group?.pairs ?? [];
  const viewSeed = seedsWithPairs.includes(seedView) ? seedView : seedsWithPairs[0] ?? seedView;
  const fedRun = group?.fed[viewSeed];
  const cenRun = group?.cen[viewSeed];

  useEffect(() => {
    setPreds({ fed: null, cen: null });
    Promise.all([fedRun ? api.predictions(fedRun.id) : null, cenRun ? api.predictions(cenRun.id) : null])
      .then(([fed, cen]) => setPreds({ fed, cen }))
      .catch(() => undefined);
  }, [fedRun?.id, cenRun?.id]);

  const agg = (runs: Experiment[]) => {
    if (!runs.length) return null;
    const mae = runs.map((r) => r.metrics!.mae);
    const rmse = runs.map((r) => r.metrics!.rmse);
    const bytes = runs.map((r) => r.metrics!.total_communication_bytes);
    const time = runs.map((r) => r.metrics!.training_time_seconds);
    return { n: runs.length, mae: [mean(mae), std(mae)], rmse: [mean(rmse), std(rmse)], bytes: [mean(bytes), std(bytes)], time: [mean(time), std(time)] };
  };
  const fedAgg = group ? agg(seedsWithPairs.map((s) => group.fed[s])) : null;
  const cenAgg = group ? agg(seedsWithPairs.map((s) => group.cen[s])) : null;
  const unit = fedRun?.metrics?.unit ?? cenRun?.metrics?.unit ?? '';

  const runBenchmark = async () => {
    try {
      let count = 0;
      for (const seed of SEEDS) {
        const r = await api.suite({ ...simConfig, seed, mode: 'federated', start_paused: false }, ['CENTRAL', 'A'], `bench-${seed}-${Date.now()}`);
        count += r.experiments.length;
      }
      addToast('Benchmark Queued', `${count} experiments queued (centralized + FedAvg for seeds ${SEEDS.join(', ')}). They run one after another.`, 'success');
      setActiveTab('experiments');
    } catch (e: any) {
      addToast('Could Not Queue Benchmark', e.message ?? String(e), 'error');
    }
  };

  const exportCsv = () => {
    if (!group) return;
    const rows = ['seed,mode,experiment_id,test_mae,test_rmse,test_mape,total_bytes,rounds,training_time_s'];
    for (const s of seedsWithPairs)
      for (const e of [group.cen[s], group.fed[s]]) {
        const m = e.metrics!;
        rows.push([s, e.mode, e.id, m.mae, m.rmse, m.mape, m.total_communication_bytes, m.completed_rounds, m.training_time_seconds].join(','));
      }
    downloadText('centralized_vs_fedavg.csv', rows.join('\n'), 'text/csv');
  };

  // Forecast chart
  const steps = fedRun?.config.horizon ?? 12;
  const interval = fedRun?.summary?.dataset.interval_minutes ?? 5;
  const h = Math.min(horizonStep, steps);
  const fedTrace = preds.fed?.traces?.[0];
  const cenTrace = preds.cen?.traces?.find((t) => t.sensor_index === fedTrace?.sensor_index) ?? null;
  const forecastSeries = useMemo(() => {
    if (!fedTrace) return [];
    const n = Math.min(288, fedTrace.timestamps.length);
    const t0 = new Date(fedTrace.timestamps[0]).getTime();
    const xs = fedTrace.timestamps.slice(0, n).map((t) => (new Date(t).getTime() - t0) / 3600000);
    const out = [
      { name: 'Actual', color: '#45464d', points: xs.map((x, i) => ({ x, y: fedTrace.missing[i] ? null : fedTrace.actual[i] })) },
      { name: `FedAvg (+${h * interval} min)`, color: PALETTE[0], points: xs.map((x, i) => ({ x, y: fedTrace.predicted_by_step[String(h)]?.[i] ?? null })) },
    ];
    if (cenTrace) out.push({ name: `Centralized (+${h * interval} min)`, color: PALETTE[1], points: xs.map((x, i) => ({ x, y: cenTrace.predicted_by_step[String(h)]?.[i] ?? null })) } as any);
    return out;
  }, [fedTrace, cenTrace, h, interval]);

  // Bandwidth projection from measured per-unit values
  const projection = useMemo(() => {
    if (!fedRun?.metrics || !fedRun.summary?.federation || !cenRun?.summary?.centralized) return null;
    const fm = fedRun.metrics;
    const clientsN = fedRun.config.num_clients;
    const perClientPerRound = fm.total_communication_bytes / Math.max(1, fm.completed_rounds) / clientsN;
    const sensors = fedRun.summary.dataset.sensors_used.length;
    const trainDays = (fedRun.config.train_frac * (fedRun.summary.dataset.splits.train.steps / fedRun.config.train_frac) * interval) / 1440;
    const rawPerSensorPerDay = cenRun.summary.centralized.raw_upload_bytes / sensors / Math.max(1e-9, (fedRun.summary.dataset.splits.train.steps * interval) / 1440);
    return { perClientPerRound, rawPerSensorPerDay, trainDays };
  }, [fedRun, cenRun, interval]);

  return (
    <div className="flex flex-col w-full animate-fade-in">
      <div className="w-full px-space-md lg:px-space-margin-desktop py-space-lg flex flex-col md:flex-row md:items-end justify-between gap-space-md max-w-[1720px] mx-auto">
        <div>
          <div className="flex items-center gap-space-xs text-secondary font-label-sm text-label-sm uppercase tracking-wider mb-1 font-bold">
            <span className="w-2 h-2 rounded-full bg-secondary"></span>
            <span>Same data, same model, same evaluation</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight font-bold">Centralized vs. FedAvg Benchmark</h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl mt-1 leading-relaxed">
            The centralized baseline uploads all raw training records and trains one model with the same number of gradient steps per evaluation epoch. FedAvg keeps raw data on the clients. Both are evaluated on the same held-out test windows.
          </p>
        </div>
        <div className="flex items-center gap-space-sm flex-wrap">
          <button onClick={exportCsv} disabled={!seedsWithPairs.length} className="px-space-md py-space-sm bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md rounded-xl font-bold cursor-pointer disabled:opacity-40 border border-surface-container-high">
            Export CSV
          </button>
          <button onClick={runBenchmark} disabled={backendOnline === false} className="px-space-md py-space-sm bg-primary text-on-primary font-label-md text-label-md rounded-xl shadow-sm font-bold cursor-pointer disabled:opacity-40">
            Run 3-seed benchmark
          </button>
        </div>
      </div>

      <OfflineBanner online={backendOnline} />

      <div className="w-full px-space-md lg:px-space-margin-desktop pb-space-lg max-w-[1720px] mx-auto space-y-space-lg">
        {!group || !seedsWithPairs.length ? (
          <EmptyState icon="compare_arrows" title="No paired results yet" action={<button onClick={runBenchmark} disabled={backendOnline === false} className="mt-2 px-3 py-1.5 bg-secondary text-on-secondary rounded-xl font-label-md text-label-md font-bold cursor-pointer disabled:opacity-40">Run 3-seed benchmark</button>}>
            A comparison needs a completed centralized run and a completed FedAvg (fp32, full participation) run with identical data and training settings. The button queues both for seeds 42, 108 and 999 using the simulator's current settings
            ({simConfig.num_clients} clients, {simConfig.partition}
            {simConfig.partition === 'dirichlet' ? ` α=${simConfig.alpha}` : ''}, {simConfig.rounds} rounds).
          </EmptyState>
        ) : (
          <>
            {groups.length > 1 && (
              <label className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-2">
                Protocol group
                <select value={group.key} onChange={(e) => setGroupKey(e.target.value)} className="bg-surface-container rounded-lg px-2 py-1 font-mono text-on-surface cursor-pointer max-w-full">
                  {groups.map((g) => (
                    <option key={g.key} value={g.key}>
                      {g.key.split('|').slice(0, 3).join(' ')} • clients {g.key.split('|')[7]} {g.key.split('|')[8]} • rounds {g.key.split('|')[10]} ({g.pairs.length} seed pair{g.pairs.length === 1 ? '' : 's'})
                    </option>
                  ))}
                </select>
              </label>
            )}

            {/* Summary table */}
            <div className={card}>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-space-sm border-b border-surface-container mb-space-sm">
                <div>
                  <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">Test results (mean ± std over {seedsWithPairs.length} seed{seedsWithPairs.length > 1 ? 's' : ''}: {seedsWithPairs.join(', ')})</h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {fedRun?.config.dataset_id.toUpperCase()} {fedRun?.config.target}, {fedRun?.metrics?.horizon_minutes}-min horizon, {fedRun?.config.num_sensors} sensors, {fedRun?.config.num_clients} clients ({fedRun?.config.partition}), {fedRun?.config.rounds} rounds.
                    {seedsWithPairs.length < 3 && ' Fewer than 3 seeds: treat the spread as indicative only.'}
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                      {['Approach', `MAE (${unit})`, 'RMSE', 'Total bytes transmitted', 'Training time', 'Raw data leaves client?'].map((x) => (
                        <th key={x} className="py-space-sm px-space-md font-bold">{x}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="font-label-md text-label-md text-on-surface divide-y divide-surface-container font-mono">
                    {[
                      { name: 'Centralized (pooled)', a: cenAgg, raw: 'Yes (all training records)' },
                      { name: 'FedAvg (fp32 updates)', a: fedAgg, raw: 'No (model updates only)' },
                    ].map((r) => (
                      <tr key={r.name}>
                        <td className="py-space-sm px-space-md font-bold font-body-md">{r.name}</td>
                        <td className="py-space-sm px-space-md">{r.a ? `${fmt(r.a.mae[0])} ± ${fmt(r.a.mae[1])}` : '—'}</td>
                        <td className="py-space-sm px-space-md">{r.a ? `${fmt(r.a.rmse[0])} ± ${fmt(r.a.rmse[1])}` : '—'}</td>
                        <td className="py-space-sm px-space-md">{r.a ? formatBytes(r.a.bytes[0]) : '—'}</td>
                        <td className="py-space-sm px-space-md">{r.a ? `${r.a.time[0].toFixed(1)} s` : '—'}</td>
                        <td className="py-space-sm px-space-md font-body-sm">{r.raw}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {fedAgg && cenAgg && (
                <div className="mt-space-sm grid grid-cols-1 md:grid-cols-3 gap-space-sm font-label-sm text-label-sm">
                  <div className="bg-surface-container-low p-space-sm rounded-xl">
                    <span className="text-on-surface-variant block">FedAvg MAE relative to centralized</span>
                    <span className="font-headline-sm text-headline-sm font-bold font-mono text-on-surface">{(((fedAgg.mae[0] - cenAgg.mae[0]) / cenAgg.mae[0]) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="bg-surface-container-low p-space-sm rounded-xl">
                    <span className="text-on-surface-variant block">FedAvg bytes ÷ centralized bytes</span>
                    <span className="font-headline-sm text-headline-sm font-bold font-mono text-on-surface">{(fedAgg.bytes[0] / cenAgg.bytes[0]).toFixed(3)}×</span>
                  </div>
                  <div className="bg-surface-container-low p-space-sm rounded-xl">
                    <span className="text-on-surface-variant block">Reading the numbers</span>
                    <span className="text-on-surface">
                      Centralized bytes are a one-off raw upload for this training period; FedAvg bytes grow with rounds and model size. Positive MAE % means FedAvg is less accurate.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Per-seed bars and per-horizon */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg">
              <div className={`xl:col-span-5 ${card}`}>
                <div className="flex items-center justify-between pb-space-sm border-b border-surface-container mb-space-sm">
                  <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">Per-seed results</h3>
                  <div className="flex gap-1">
                    {(['mae', 'rmse', 'bytes'] as const).map((k) => (
                      <button key={k} onClick={() => setMetric(k)} className={`px-2 py-0.5 rounded-lg font-label-sm text-label-sm font-bold uppercase cursor-pointer ${metric === k ? 'bg-secondary text-on-secondary' : 'bg-surface-container text-on-surface-variant'}`}>
                        {k}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  {seedsWithPairs.map((s) => {
                    const vals = [group.cen[s], group.fed[s]].map((e) => (metric === 'bytes' ? e.metrics!.total_communication_bytes : e.metrics![metric]));
                    const max = Math.max(...vals);
                    return (
                      <div key={s}>
                        <span className="font-label-sm text-label-sm font-bold text-on-surface">Seed {s}</span>
                        {['Centralized', 'FedAvg'].map((name, i) => (
                          <div key={name} className="flex items-center gap-2 mt-1">
                            <span className="w-24 font-label-sm text-label-sm text-on-surface-variant">{name}</span>
                            <div className="flex-1 bg-surface-container h-4 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${(vals[i] / max) * 100}%`, background: i ? PALETTE[0] : PALETTE[1] }} />
                            </div>
                            <span className="w-24 text-right font-mono font-label-sm text-label-sm text-on-surface">{metric === 'bytes' ? formatBytes(vals[i]) : vals[i].toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className={`xl:col-span-7 ${card}`}>
                <div className="flex items-center justify-between pb-space-sm border-b border-surface-container mb-space-sm">
                  <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">Test MAE by forecast step (seed {viewSeed})</h3>
                  <select value={viewSeed} onChange={(e) => setSeedView(+e.target.value)} className="bg-surface-container rounded-lg px-2 py-0.5 font-mono text-on-surface cursor-pointer">
                    {seedsWithPairs.map((s) => (
                      <option key={s} value={s}>Seed {s}</option>
                    ))}
                  </select>
                </div>
                <LineChart
                  series={[
                    { name: 'Centralized', color: PALETTE[1], points: (cenRun?.metrics?.mae_per_step ?? []).map((v, i) => ({ x: (i + 1) * interval, y: v })) },
                    { name: 'FedAvg', color: PALETTE[0], points: (fedRun?.metrics?.mae_per_step ?? []).map((v, i) => ({ x: (i + 1) * interval, y: v })) },
                  ]}
                  xLabel="Minutes ahead"
                  yLabel={`MAE (${unit})`}
                  yFormat={(v) => v.toFixed(1)}
                />
              </div>
            </div>

            {/* Forecast overlay */}
            <div className={card}>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-space-sm border-b border-surface-container mb-space-sm">
                <div>
                  <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">Forecast overlay on held-out test data</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {fedTrace ? `Sensor ${fedTrace.sensor_index}, first 24 h of the test period (${new Date(fedTrace.timestamps[0]).toLocaleString()}).` : 'Loading predictions…'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {[1, 3, 6, 9, 12].filter((s) => s <= steps).map((s) => (
                    <button key={s} onClick={() => setHorizonStep(s)} className={`px-2 py-0.5 rounded-lg font-label-sm text-label-sm font-bold cursor-pointer ${h === s ? 'bg-secondary text-on-secondary' : 'bg-surface-container text-on-surface-variant'}`}>
                      {s * interval} min
                    </button>
                  ))}
                </div>
              </div>
              <LineChart series={forecastSeries} xLabel="Hours" yLabel={unit} xFormat={(v) => `${v.toFixed(0)}h`} xTicks={[0, 4, 8, 12, 16, 20, 24]} emptyText="Predictions unavailable" />
            </div>

            {/* Projection */}
            <div className={card}>
              <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">Bandwidth projection (what-if)</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-sm">
                Scales measured per-unit values from seed {viewSeed}. This is an extrapolation, not a measurement: it assumes one roadside unit per client, one sensor per unit, and one training round per day.
              </p>
              {projection ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md items-end">
                  <div className="space-y-2">
                    <label className="block font-label-sm text-label-sm text-on-surface-variant">
                      Roadside units: <strong className="text-on-surface font-mono">{units}</strong>
                      <input type="range" min={1} max={500} value={units} onChange={(e) => setUnits(+e.target.value)} className="w-full accent-secondary" />
                    </label>
                    <label className="block font-label-sm text-label-sm text-on-surface-variant">
                      Days: <strong className="text-on-surface font-mono">{days}</strong>
                      <input type="range" min={1} max={365} value={days} onChange={(e) => setDays(+e.target.value)} className="w-full accent-secondary" />
                    </label>
                  </div>
                  <div className="bg-surface-container-low p-space-sm rounded-xl">
                    <span className="font-label-sm text-label-sm text-on-surface-variant block">Raw upload (centralized)</span>
                    <span className="font-headline-sm text-headline-sm font-bold font-mono text-on-surface">{formatBytes(projection.rawPerSensorPerDay * units * days)}</span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant block">{formatBytes(projection.rawPerSensorPerDay)} per sensor per day (measured)</span>
                  </div>
                  <div className="bg-surface-container-low p-space-sm rounded-xl">
                    <span className="font-label-sm text-label-sm text-on-surface-variant block">FedAvg traffic (1 round/day)</span>
                    <span className="font-headline-sm text-headline-sm font-bold font-mono text-secondary">{formatBytes(projection.perClientPerRound * units * days)}</span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant block">{formatBytes(projection.perClientPerRound)} per client per round (measured)</span>
                  </div>
                </div>
              ) : (
                <EmptyState title="Needs a completed pair">Run the benchmark to get measured per-unit values.</EmptyState>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
