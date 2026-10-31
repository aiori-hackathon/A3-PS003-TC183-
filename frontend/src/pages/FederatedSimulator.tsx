import React, { useEffect, useMemo, useRef, useState } from 'react';
import { isActiveStatus, useApp } from '../context/AppContext';
import { TrafficMapCanvas } from '../components/TrafficMapCanvas';
import { LineChart, EmptyState, StatusBadge, OfflineBanner, PALETTE } from '../components/charts';
import { api, downloadText, formatBytes, fmt, Predictions, RoundRecord } from '../api/client';

const card = 'bg-surface-container-lowest p-space-lg rounded-2xl shadow-sm border border-surface-container/70';
const pill = (on: boolean) =>
  `py-2 px-2 text-center rounded-xl font-label-sm text-label-sm transition-all cursor-pointer ${
    on ? 'bg-secondary text-on-secondary shadow-sm font-bold' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
  }`;

const prefixClass = (level: string) =>
  ({
    accent: 'text-secondary font-bold',
    success: 'text-on-tertiary-container font-bold',
    node: 'text-on-tertiary-container font-bold',
    server: 'text-primary font-bold',
    error: 'text-error font-bold',
    warning: 'text-amber-700 font-bold',
  }[level] ?? 'text-on-surface font-semibold');

export const FederatedSimulator: React.FC = () => {
  const {
    backendOnline,
    activeExperiment: exp,
    activeRounds: rounds,
    activeEvents: events,
    experiments,
    simConfig,
    setSimConfig,
    simBusy,
    currentRound,
    maxRounds,
    isPlaying,
    globalMAE,
    globalRMSE,
    maeKind,
    metricUnit,
    networkTransferredMB,
    stepRound,
    fastForwardToRound,
    resetSimulator,
    togglePlaySimulator,
    setCurrentClients,
    setCurrentAlpha,
    setCurrentSeed,
    setIsNodeClusterModalOpen,
    setActiveTab,
    addToast,
  } = useApp();

  const [selectedClient, setSelectedClient] = useState(0);
  const [horizonStep, setHorizonStep] = useState<number>(3);
  const [logFilter, setLogFilter] = useState<'all' | 'round' | 'node' | 'server' | 'fedavg'>('all');
  const [logSearch, setLogSearch] = useState('');
  const [clearedAt, setClearedAt] = useState(0);
  const [predictions, setPredictions] = useState<Predictions | null>(null);
  const [centralRounds, setCentralRounds] = useState<RoundRecord[] | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  const live = !!exp && isActiveStatus(exp.status);
  const fed = exp?.summary?.federation;
  const clients = fed?.clients ?? [];
  const lastRound = rounds.length ? rounds[rounds.length - 1] : null;
  const dataset = exp?.summary?.dataset;
  const interval = dataset?.interval_minutes ?? 5;

  // Predictions after completion
  useEffect(() => {
    setPredictions(null);
    if (exp?.status === 'completed') api.predictions(exp.id).then(setPredictions).catch(() => setPredictions(null));
  }, [exp?.id, exp?.status]);

  // Matching centralized baseline (same data protocol) for the convergence chart
  const centralMatch = useMemo(() => {
    if (!exp) return null;
    const c = exp.config;
    return (
      experiments.find(
        (e) =>
          e.mode === 'centralized' &&
          e.status === 'completed' &&
          e.config.dataset_id === c.dataset_id &&
          e.config.target === c.target &&
          e.config.horizon === c.horizon &&
          e.config.num_sensors === c.num_sensors &&
          e.config.seed === c.seed
      ) ?? null
    );
  }, [exp, experiments]);

  useEffect(() => {
    setCentralRounds(null);
    if (centralMatch) api.rounds(centralMatch.id).then(setCentralRounds).catch(() => setCentralRounds(null));
  }, [centralMatch?.id]);

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [events.length]);

  const filteredLogs = events.filter((log) => {
    if (log.id <= clearedAt) return false;
    if (logFilter === 'round' && !log.prefix.includes('ROUND')) return false;
    if (logFilter === 'node' && !log.prefix.includes('NODE')) return false;
    if (logFilter === 'server' && !log.prefix.includes('SERVER')) return false;
    if (logFilter === 'fedavg' && !log.prefix.includes('FEDAVG')) return false;
    if (logSearch.trim()) {
      const q = logSearch.toLowerCase();
      return log.prefix.toLowerCase().includes(q) || log.text.toLowerCase().includes(q);
    }
    return true;
  });

  const handleDownloadLogs = () => {
    if (!exp) return;
    downloadText(`experiment_${exp.id}_events.log`, events.map((l) => `[${l.ts}] ${l.prefix} ${l.text}`).join('\n'));
    addToast('Log Exported', `Downloaded ${events.length} backend events.`, 'info');
  };

  const isFederatedRun = !exp || exp.mode === 'federated';
  const alphaSel = simConfig.partition === 'iid' ? 'iid' : simConfig.partition === 'contiguous' ? 'contiguous' : String(simConfig.alpha);
  const maxClients = Math.min(10, simConfig.num_sensors);

  // Prediction trace for the selected client
  const trace = predictions?.available ? predictions.traces.find((t) => t.client_id === selectedClient) ?? predictions.traces[0] : null;
  const steps = predictions?.horizon_steps ?? exp?.config.horizon ?? 12;
  const hStep = Math.min(horizonStep, steps);
  const traceView = useMemo(() => {
    if (!trace) return null;
    const n = Math.min(288, trace.timestamps.length);
    const pred = trace.predicted_by_step[String(hStep)] ?? [];
    const t0 = new Date(trace.timestamps[0]).getTime();
    let abs = 0;
    let cnt = 0;
    const actualPts = [];
    const predPts = [];
    for (let i = 0; i < n; i++) {
      const x = (new Date(trace.timestamps[i]).getTime() - t0) / 3600000;
      const a = trace.missing[i] ? null : trace.actual[i];
      actualPts.push({ x, y: a });
      predPts.push({ x, y: pred[i] ?? null });
      if (a !== null && pred[i] !== undefined) {
        abs += Math.abs(pred[i] - a);
        cnt++;
      }
    }
    return { actualPts, predPts, mae: cnt ? abs / cnt : null, start: trace.timestamps[0], points: n };
  }, [trace, hStep]);

  const t0Label = traceView ? new Date(traceView.start) : null;

  return (
    <div className="flex flex-col w-full animate-fade-in">
      {/* Context ribbon */}
      <div className="px-space-md lg:px-space-margin-desktop py-space-sm bg-surface-container-high flex flex-wrap items-center justify-between gap-space-sm border-b border-surface-container">
        <div className="flex items-center gap-space-sm flex-wrap">
          <span className="px-2 py-0.5 rounded-lg bg-primary text-on-primary font-label-sm text-label-sm uppercase tracking-wider font-bold">
            FEDERATED LEARNING • REAL TRAINING
          </span>
          <span className="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight">Federated Traffic-Flow Training &amp; Communication Ledger</span>
          <span className="px-2 py-0.5 rounded-lg bg-surface-container text-on-surface-variant font-label-sm text-label-sm">
            Dataset: {dataset ? `${dataset.id.toUpperCase()} • ${dataset.target} (${dataset.unit}) • ${dataset.sensors_used.length} sensors` : `${simConfig.dataset_id.toUpperCase()} • ${simConfig.target}`}
            {dataset?.is_synthetic && ' • SYNTHETIC'}
          </span>
        </div>
        <div className="flex items-center gap-space-md">
          {exp && <StatusBadge status={exp.status} paused={exp.paused} />}
          <button
            onClick={() => setIsNodeClusterModalOpen(true)}
            className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-tertiary-container bg-surface-container-lowest px-2.5 py-1 rounded-lg border border-surface-container shadow-2xs hover:bg-surface-container transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px]">hub</span>
            <span>{exp ? exp.config.num_clients : simConfig.num_clients} CLIENTS</span>
          </button>
          <span className="font-label-sm text-label-sm text-on-surface-variant hidden md:inline">
            Split: {Math.round((exp?.config.train_frac ?? 0.7) * 100)}/{Math.round((exp?.config.val_frac ?? 0.15) * 100)}/
            {Math.round((1 - (exp?.config.train_frac ?? 0.7) - (exp?.config.val_frac ?? 0.15)) * 100)} chronological
          </span>
        </div>
      </div>

      <OfflineBanner online={backendOnline} />

      <div className="p-space-md lg:p-space-margin-desktop space-y-space-lg">
        {exp && !isFederatedRun && (
          <div className="p-space-sm rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 font-label-md text-label-md">
            The selected experiment is a centralized baseline. Federated views (clients, aggregation weights) do not apply. Start a federated run below or pick one in Experiments.
          </div>
        )}
        {exp?.status === 'failed' && (
          <div className="p-space-sm rounded-xl bg-error/10 border border-error/30 text-error font-label-md text-label-md" role="alert">
            Experiment failed: {exp.error}
          </div>
        )}

        {/* KPI strip */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-space-md">
          <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-sm border border-surface-container/70 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="font-label-sm text-label-sm uppercase text-on-surface-variant font-semibold">Communication Round</span>
              <span className="material-symbols-outlined text-secondary text-[20px]">sync</span>
            </div>
            <div className="mt-2">
              <div className="flex items-baseline gap-1.5">
                <span className="font-headline-xl text-headline-xl text-on-surface font-bold font-mono">{currentRound}</span>
                <span className="font-label-md text-label-md text-on-surface-variant">/ {maxRounds}</span>
              </div>
              <div className="w-full bg-surface-container h-1.5 rounded-full mt-2 overflow-hidden">
                <div className="bg-secondary h-full transition-all duration-300" style={{ width: `${maxRounds ? (currentRound / maxRounds) * 100 : 0}%` }}></div>
              </div>
            </div>
            <div className="mt-2.5 pt-2 flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant border-t border-surface-container">
              <span>Completed: {exp?.completed_rounds ?? 0}</span>
              <span className="font-bold">{exp ? exp.status : 'ready'}</span>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-sm border border-surface-container/70 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="font-label-sm text-label-sm uppercase text-on-surface-variant font-semibold">
                {maeKind === 'test' ? 'Test MAE (final)' : 'Validation MAE'}
              </span>
              <span className="material-symbols-outlined text-secondary text-[20px]">show_chart</span>
            </div>
            <div className="mt-2">
              <div className="flex items-baseline gap-2">
                <span className="font-headline-xl text-headline-xl text-on-surface font-bold font-mono">{globalMAE}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">{metricUnit}</span>
              </div>
              <span className="font-label-sm text-label-sm text-on-tertiary-container font-bold">RMSE: {globalRMSE}</span>
            </div>
            <div className="mt-2.5 pt-2 flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant border-t border-surface-container">
              <span>Central: {centralMatch?.metrics ? fmt(centralMatch.metrics.mae) : 'not run'}</span>
              {centralMatch?.metrics && exp?.metrics && (
                <span className="text-secondary font-bold">Gap: {(((exp.metrics.mae - centralMatch.metrics.mae) / centralMatch.metrics.mae) * 100).toFixed(1)}%</span>
              )}
            </div>
          </div>

          <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-sm border border-surface-container/70 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="font-label-sm text-label-sm uppercase text-on-surface-variant font-semibold">Measured Communication</span>
              <span className="material-symbols-outlined text-secondary text-[20px]">cell_tower</span>
            </div>
            <div className="mt-2">
              <div className="flex items-baseline gap-2">
                <span className="font-headline-xl text-headline-xl text-on-surface font-bold font-mono">{networkTransferredMB === null ? '—' : networkTransferredMB.toFixed(2)}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">MB</span>
              </div>
              <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">
                {lastRound ? `${formatBytes(lastRound.total_bytes)} last round (up + down)` : 'No rounds yet'}
              </p>
            </div>
            <div className="mt-2.5 pt-2 flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant border-t border-surface-container">
              <span>Raw data kept local</span>
              <span className="text-on-tertiary-container font-bold">{fed ? formatBytes(fed.raw_training_bytes_total) : '—'}</span>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-sm border border-surface-container/70 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="font-label-sm text-label-sm uppercase text-on-surface-variant font-semibold">Heterogeneity</span>
              <span className="material-symbols-outlined text-secondary text-[20px]">hub</span>
            </div>
            <div className="mt-2">
              <span className="font-headline-lg text-headline-lg text-on-surface font-bold font-mono">
                {fed ? (fed.partition === 'dirichlet' ? `α = ${fed.alpha}` : fed.partition.toUpperCase()) : alphaSel === 'iid' ? 'IID' : alphaSel === 'contiguous' ? 'CONTIG.' : `α = ${alphaSel}`}
              </span>
              <span className="block mt-1 font-label-sm text-label-sm text-on-surface-variant">
                {fed ? 'Partition of the active run' : 'Next run setting'}
              </span>
            </div>
            <div className="mt-2.5 pt-2 flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant border-t border-surface-container" title="Mean total-variation distance between each client's traffic-level histogram and the global one (0 = identical)">
              <span>TV distance: {fed ? fed.heterogeneity.mean.toFixed(3) : '—'}</span>
              <span className="text-secondary font-bold">measured</span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-primary-container to-[#1a233a] text-on-primary-container p-space-md rounded-2xl shadow-md flex flex-col justify-between border border-secondary/20">
            <div className="flex justify-between items-start text-on-primary">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-surface-variant font-semibold">FL Controller</span>
              <span className={`material-symbols-outlined text-[18px] text-tertiary-fixed ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }}>
                settings_sync
              </span>
            </div>
            <div className="my-1">
              <div className="font-headline-md text-headline-md text-on-primary font-bold">{exp ? `Round ${currentRound}` : 'Not started'}</div>
              <p className="font-label-sm text-label-sm text-surface-variant mt-0.5">
                {!exp ? 'Run trains a new model on the backend' : isPlaying ? 'Training on backend…' : live ? 'Paused (waiting for step/resume)' : `Finished: ${exp.status}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlaySimulator}
                disabled={simBusy || backendOnline === false}
                className={`flex-1 py-1.5 px-3 rounded-lg font-label-md text-label-md font-semibold flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isPlaying ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-on-tertiary-container hover:opacity-90 text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{isPlaying ? 'pause' : 'play_arrow'}</span>
                <span>{isPlaying ? 'Pause' : live ? 'Resume' : 'Run'}</span>
              </button>
              <button
                onClick={() => stepRound(1)}
                disabled={simBusy || backendOnline === false}
                className="py-1.5 px-3 bg-secondary hover:bg-secondary/90 text-on-secondary rounded-lg font-label-md text-label-md font-semibold flex items-center justify-center transition-all shadow cursor-pointer active:scale-95 disabled:opacity-50"
                title="Execute one FedAvg round, then pause"
              >
                <span className="material-symbols-outlined text-[16px]">skip_next</span>
                <span>+1</span>
              </button>
            </div>
          </div>
        </div>

        <TrafficMapCanvas />

        {/* Controls & server */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
          <div className={`lg:col-span-5 ${card} flex flex-col justify-between space-y-space-md`}>
            <div>
              <div className="flex items-center justify-between pb-space-sm border-b border-surface-container">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-[22px]">tune</span>
                  <span className="font-headline-sm text-headline-sm font-bold text-on-surface">Next Run Configuration</span>
                </div>
                <button onClick={() => setActiveTab('experiments')} className="font-label-sm text-label-sm text-secondary hover:underline cursor-pointer">
                  All settings →
                </button>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 leading-relaxed">
                These settings apply to the next experiment you start. A running experiment keeps the settings it started with.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1.5 font-label-md text-label-md">
                  <label htmlFor="clients" className="text-on-surface font-bold">Clients (K)</label>
                  <span className="font-bold text-secondary font-mono">{simConfig.num_clients} clients</span>
                </div>
                <input
                  id="clients"
                  type="range"
                  min="2"
                  max={maxClients}
                  step="1"
                  value={simConfig.num_clients}
                  onChange={(e) => setCurrentClients(parseInt(e.target.value, 10))}
                  className="w-full accent-secondary h-2 bg-surface-container rounded-lg cursor-pointer"
                />
                <div className="flex justify-between font-label-sm text-label-sm text-on-surface-variant mt-1">
                  <span>2</span>
                  <span>{simConfig.num_sensors} sensors split across clients</span>
                  <span>{maxClients}</span>
                </div>
              </div>

              <div>
                <span className="block font-label-md text-label-md font-bold text-on-surface mb-1.5">Data partition across clients</span>
                <div className="grid grid-cols-4 gap-2">
                  <button onClick={() => setCurrentAlpha(100)} className={pill(alphaSel === 'iid')}>
                    <div className="font-bold">IID</div>
                    <div className="text-[10px] opacity-80">Shuffled</div>
                  </button>
                  <button onClick={() => setSimConfig({ partition: 'contiguous' })} className={pill(alphaSel === 'contiguous')}>
                    <div className="font-bold">Contiguous</div>
                    <div className="text-[10px] opacity-80">By sensor ID</div>
                  </button>
                  <button onClick={() => setCurrentAlpha(0.5)} className={pill(alphaSel === '0.5')}>
                    <div className="font-bold">α = 0.5</div>
                    <div className="text-[10px] opacity-80">Moderate skew</div>
                  </button>
                  <button onClick={() => setCurrentAlpha(0.1)} className={pill(alphaSel === '0.1')}>
                    <div className="font-bold">α = 0.1</div>
                    <div className="text-[10px] opacity-80">Severe skew</div>
                  </button>
                </div>
              </div>

              <div>
                <span className="block font-label-md text-label-md font-bold text-on-surface mb-1.5">Random seed</span>
                <div className="flex gap-2">
                  {[42, 108, 999].map((s) => (
                    <button key={s} onClick={() => setCurrentSeed(s)} className={`flex-1 ${pill(simConfig.seed === s)} font-mono`}>
                      Seed {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <label className="font-label-sm text-label-sm text-on-surface-variant">
                  Rounds
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={simConfig.rounds}
                    onChange={(e) => setSimConfig({ rounds: Math.max(1, Math.min(500, parseInt(e.target.value || '1', 10))) })}
                    className="mt-1 w-full px-2 py-1.5 bg-surface-container rounded-lg font-mono text-on-surface outline-none focus:ring-1 focus:ring-secondary"
                  />
                </label>
                <label className="font-label-sm text-label-sm text-on-surface-variant">
                  Uplink encoding
                  <select
                    value={simConfig.uplink_encoding}
                    onChange={(e) => setSimConfig({ uplink_encoding: e.target.value as any })}
                    className="mt-1 w-full px-2 py-1.5 bg-surface-container rounded-lg font-mono text-on-surface outline-none focus:ring-1 focus:ring-secondary cursor-pointer"
                  >
                    <option value="fp32">FP32</option>
                    <option value="fp16">FP16</option>
                    <option value="int8">INT8</option>
                    <option value="topk">Top-k 5%</option>
                  </select>
                </label>
                <label className="font-label-sm text-label-sm text-on-surface-variant">
                  Participation
                  <select
                    value={simConfig.client_fraction}
                    onChange={(e) => setSimConfig({ client_fraction: parseFloat(e.target.value) })}
                    className="mt-1 w-full px-2 py-1.5 bg-surface-container rounded-lg font-mono text-on-surface outline-none focus:ring-1 focus:ring-secondary cursor-pointer"
                  >
                    <option value={1}>100%</option>
                    <option value={0.8}>80%</option>
                    <option value={0.6}>60%</option>
                    <option value={0.4}>40%</option>
                  </select>
                </label>
              </div>

              <div className="bg-surface-container-low p-space-sm rounded-xl grid grid-cols-3 gap-2 text-center font-label-sm text-label-sm border border-surface-container">
                <div>
                  <span className="text-on-surface-variant block">Model</span>
                  <span className="font-bold text-on-surface">{exp?.summary?.model ? `GRU (${exp.summary.model.parameters.toLocaleString()} params)` : 'GRU forecaster'}</span>
                </div>
                <div>
                  <span className="text-on-surface-variant block">Local training</span>
                  <span className="font-bold text-on-surface">
                    E={exp?.config.local_epochs ?? simConfig.local_epochs} × {exp?.config.max_local_steps ?? simConfig.max_local_steps} steps
                  </span>
                </div>
                <div>
                  <span className="text-on-surface-variant block">Forecast</span>
                  <span className="font-bold text-on-surface">
                    {(exp?.config.input_len ?? 12) * interval} min → {(exp?.config.horizon ?? simConfig.horizon) * interval} min
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-surface-container">
              <button
                onClick={() => stepRound(5)}
                disabled={simBusy || backendOnline === false}
                className="flex-1 bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">fast_forward</span>
                <span>+5 Rounds</span>
              </button>
              <button
                onClick={() => fastForwardToRound(maxRounds)}
                disabled={simBusy || backendOnline === false}
                className="flex-1 bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
                <span>Run to End</span>
              </button>
              <button
                onClick={resetSimulator}
                className="bg-surface-container-lowest hover:bg-surface-container text-error font-label-md text-label-md py-2 px-3 rounded-xl flex items-center justify-center gap-1 transition-colors cursor-pointer border border-error/20"
                title={live ? 'Cancel the running experiment and clear the view' : 'Clear the view'}
              >
                <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                <span>{live ? 'Cancel & Reset' : 'Reset'}</span>
              </button>
            </div>
          </div>

          <div className={`lg:col-span-7 ${card} flex flex-col justify-between space-y-space-md`}>
            <div>
              <div className="flex items-center justify-between pb-space-sm border-b border-surface-container">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-[22px]">dns</span>
                  <span className="font-headline-sm text-headline-sm font-bold text-on-surface">Aggregation Server ({(fed?.aggregation ?? 'fedavg').toUpperCase()})</span>
                </div>
                {lastRound && (
                  <span
                    className={`font-label-sm text-label-sm px-2.5 py-1 rounded-lg font-bold ${
                      lastRound.status === 'completed' ? 'bg-on-tertiary-container/15 text-on-tertiary-container' : lastRound.status === 'partial' ? 'bg-amber-500/15 text-amber-700' : 'bg-error/15 text-error'
                    }`}
                  >
                    Round {lastRound.round}: {lastRound.status}
                  </span>
                )}
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 leading-relaxed">
                Computes <code className="font-mono text-label-sm bg-surface-container px-1 py-0.5 rounded text-secondary font-bold">w_t+1 = w_t + ∑ (n_k / N) Δ_k</code> over the clients whose updates arrived, where n_k is
                each client's number of training windows. Clients upload updates Δ_k, never raw readings.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center font-label-sm text-label-sm">
                <span className="text-on-surface font-bold uppercase tracking-wider">Client weights (n_k / N)</span>
                <span className="text-on-surface-variant font-mono">N = {clients.reduce((a, c) => a + c.train_windows, 0).toLocaleString()} training windows</span>
              </div>
              {clients.length ? (
                <>
                  <div className="w-full h-8 rounded-xl overflow-hidden flex shadow-inner font-label-sm text-label-sm text-white font-bold">
                    {clients.map((c, i) => (
                      <div
                        key={c.client_id}
                        className="flex items-center justify-center transition-all duration-500 overflow-hidden whitespace-nowrap"
                        style={{ width: `${c.fedavg_weight * 100}%`, background: PALETTE[i % PALETTE.length] }}
                        title={`${c.name}: ${(c.fedavg_weight * 100).toFixed(1)}% (${c.train_windows.toLocaleString()} windows)`}
                      >
                        {c.fedavg_weight > 0.07 ? `${c.label}: ${(c.fedavg_weight * 100).toFixed(0)}%` : c.label}
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 font-label-sm text-label-sm text-on-surface-variant pt-1">
                    {clients.map((c, i) => (
                      <span key={c.client_id}>
                        <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: PALETTE[i % PALETTE.length] }}></span>
                        {c.name} ({c.num_sensors} sensors, {(c.fedavg_weight * 100).toFixed(1)}%)
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState title="No federation yet">Start a run to partition sensors across clients and compute aggregation weights.</EmptyState>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm pt-2">
              <div className="bg-surface-container-low p-space-sm rounded-xl border border-surface-container">
                <span className="font-label-sm text-label-sm text-on-surface-variant block">Model payload (fp32)</span>
                <span className="font-headline-sm text-headline-sm text-on-surface font-mono font-bold">{exp?.summary ? formatBytes(exp.summary.model.fp32_bytes) : '—'}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant block mt-0.5">{exp?.summary ? `${exp.summary.model.parameters.toLocaleString()} float32` : 'parameters'}</span>
              </div>
              <div className="bg-surface-container-low p-space-sm rounded-xl border border-surface-container">
                <span className="font-label-sm text-label-sm text-on-surface-variant block">Last round wall time</span>
                <span className="font-headline-sm text-headline-sm text-secondary font-mono font-bold">{lastRound ? `${lastRound.duration_s.toFixed(2)} s` : '—'}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant block mt-0.5">train + aggregate + validate</span>
              </div>
              <div className="bg-surface-container-low p-space-sm rounded-xl border border-surface-container">
                <span className="font-label-sm text-label-sm text-on-surface-variant block">Uplink per client</span>
                <span className="font-headline-sm text-headline-sm text-on-surface font-mono font-bold">
                  {lastRound && lastRound.successful_clients.length ? formatBytes(lastRound.upload_bytes / lastRound.successful_clients.length) : '—'}
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant block mt-0.5">{exp?.config.uplink_encoding ?? simConfig.uplink_encoding} update</span>
              </div>
              <div className="bg-surface-container-low p-space-sm rounded-xl border border-surface-container">
                <span className="font-label-sm text-label-sm text-on-surface-variant block">Est. transfer time</span>
                <span className="font-headline-sm text-headline-sm text-on-tertiary-container font-mono font-bold">{lastRound ? `${(lastRound.est_transfer_s * 1000).toFixed(0)} ms` : '—'}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant block mt-0.5">
                  estimate @ {exp?.config.uplink_kbps ?? 1000} kbps up
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Client cards */}
        <div className={`${card} space-y-space-md`}>
          <div className="flex flex-wrap items-center justify-between gap-space-sm pb-space-sm border-b border-surface-container">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[22px]">share_location</span>
              <div>
                <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">Simulated Clients (Roadside Units)</h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">Each client owns a disjoint group of real sensors and trains only on its own windows.</p>
              </div>
            </div>
            <button
              onClick={() => setIsNodeClusterModalOpen(true)}
              className="px-3 py-1.5 bg-surface-container hover:bg-surface-container-high text-secondary font-label-sm text-label-sm font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">tune</span>
              <span>Client Inspector</span>
            </button>
          </div>
          {clients.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-space-md">
              {clients.map((c, i) => {
                const participated = lastRound ? lastRound.participants.includes(c.client_id) : false;
                const succeeded = lastRound ? lastRound.successful_clients.includes(c.client_id) : false;
                const loss = lastRound?.client_losses?.[String(c.client_id)];
                const testRow = exp?.metrics?.per_client_test.find((p) => p.client_id === c.client_id);
                return (
                  <button
                    key={c.client_id}
                    onClick={() => setSelectedClient(c.client_id)}
                    className={`text-left bg-surface-container-low p-space-md rounded-2xl border transition-all duration-300 cursor-pointer ${
                      selectedClient === c.client_id ? 'border-secondary shadow-md bg-surface-container ring-2 ring-secondary/20' : 'border-surface-container hover:border-secondary/40'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }}></span>
                        <span className="font-label-md text-label-md font-bold text-on-surface">{c.name}</span>
                      </div>
                      <span
                        className={`font-label-sm text-label-sm px-1.5 py-0.5 rounded-lg font-mono ${
                          !lastRound ? 'bg-surface-container text-on-surface-variant' : succeeded ? 'bg-on-tertiary-container/15 text-on-tertiary-container' : participated ? 'bg-error/15 text-error' : 'bg-surface-container text-on-surface-variant'
                        }`}
                      >
                        {!lastRound ? 'idle' : succeeded ? 'uploaded' : participated ? 'dropped' : 'not sampled'}
                      </span>
                    </div>
                    <div className="font-label-sm text-label-sm text-on-surface-variant mb-2 line-clamp-2" title={c.sensors.join(', ')}>
                      Sensors: {c.sensors.slice(0, 6).join(', ')}
                      {c.sensors.length > 6 ? ` +${c.sensors.length - 6}` : ''}
                    </div>
                    <div className="space-y-1.5 font-label-sm text-label-sm text-on-surface-variant pt-2 border-t border-surface-container">
                      <div className="flex justify-between">
                        <span>Training windows:</span>
                        <span className="font-mono font-bold text-on-surface">{c.train_windows.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Mean {dataset?.target}:</span>
                        <span className="font-mono text-on-surface">{c.mean_target.toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Local loss (L1, norm.):</span>
                        <span className="font-mono font-bold text-secondary">{loss !== undefined && loss !== null ? loss.toFixed(4) : '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Test MAE:</span>
                        <span className="font-mono text-on-surface">{testRow ? testRow.mae.toFixed(2) : '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Raw data kept local:</span>
                        <span className="font-mono text-on-tertiary-container font-bold">{formatBytes(c.raw_training_bytes_kept_local, 1)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState icon="hub" title="No clients yet">
              Press <strong>Run</strong> or <strong>+1</strong> to start a federated experiment. The backend assigns sensors to clients and shows them here.
            </EmptyState>
          )}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
          <div className={`lg:col-span-6 ${card} flex flex-col`}>
            <div className="flex items-center justify-between pb-space-sm border-b border-surface-container">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[22px]">analytics</span>
                <span className="font-headline-sm text-headline-sm font-bold text-on-surface">Convergence: Validation MAE per Round</span>
              </div>
              <span className="font-label-sm text-label-sm bg-surface-container px-2 py-0.5 rounded-lg text-secondary font-mono font-bold">Round {currentRound}</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 mb-3">
              Global model evaluated on every client's validation windows after each aggregation ({metricUnit}).
              {centralMatch ? ' Dashed: centralized baseline with the same data protocol (per evaluation epoch).' : ' Run a centralized baseline with the same seed to overlay it.'}
            </p>
            <LineChart
              series={[
                { name: 'FedAvg validation MAE', color: PALETTE[0], width: 2.5, points: rounds.map((r) => ({ x: r.round, y: r.status === 'failed' ? null : r.val_mae })) },
                ...(centralRounds ? [{ name: 'Centralized validation MAE', color: '#0b1c30', dashed: true, points: centralRounds.map((r) => ({ x: r.round, y: r.val_mae })) }] : []),
              ]}
              xLabel="Round"
              yLabel={`MAE (${metricUnit})`}
              yFormat={(v) => v.toFixed(1)}
              emptyText="Validation MAE appears here after the first round"
              ariaLabel="Validation MAE by round"
            />
          </div>

          <div className={`lg:col-span-6 ${card} flex flex-col`}>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-space-sm border-b border-surface-container">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[22px]">timeline</span>
                <span className="font-headline-sm text-headline-sm font-bold text-on-surface">Forecast vs Actual (test period)</span>
              </div>
              <label className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
                Horizon
                <select
                  value={hStep}
                  onChange={(e) => setHorizonStep(parseInt(e.target.value, 10))}
                  className="bg-surface-container rounded-lg px-1.5 py-0.5 font-mono text-on-surface cursor-pointer"
                >
                  {Array.from({ length: steps }, (_, i) => i + 1).map((s) => (
                    <option key={s} value={s}>
                      {s * interval} min
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 mb-3">
              {trace
                ? `${trace.client_name}, sensor ${trace.sensor_index}: first 24 h of the held-out test period from ${t0Label?.toLocaleString()}. Each predicted point was forecast ${hStep * interval} min earlier. Model: round ${predictions?.checkpoint_round} checkpoint.`
                : 'Shown after the experiment completes. Predictions come from the checkpoint with the best validation MAE, on held-out test data.'}
            </p>
            {traceView ? (
              <>
                <LineChart
                  series={[
                    { name: 'Actual', color: '#45464d', points: traceView.actualPts },
                    { name: `Predicted (+${hStep * interval} min)`, color: PALETTE[0], points: traceView.predPts },
                  ]}
                  xLabel="Hours from start of window"
                  yLabel={predictions?.unit}
                  xFormat={(v) => `${v.toFixed(0)}h`}
                  xTicks={[0, 4, 8, 12, 16, 20, 24]}
                  ariaLabel="Actual versus predicted traffic"
                />
                <div className="flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant pt-2 border-t border-surface-container mt-2">
                  <span>MAE over these {traceView.points} points: <strong className="text-on-surface">{fmt(traceView.mae)} {predictions?.unit}</strong></span>
                  <span>Missing readings are left as gaps</span>
                </div>
              </>
            ) : (
              <EmptyState icon="timeline" title={live ? 'Training in progress' : 'No predictions yet'}>
                {live ? 'Forecasts are generated on the test split once all rounds finish.' : 'Complete a run to see forecasts.'}
              </EmptyState>
            )}
          </div>
        </div>

        {/* Event stream & checks */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
          <div className={`lg:col-span-7 ${card} flex flex-col`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-space-sm gap-2 border-b border-surface-container">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[22px]">terminal</span>
                <span className="font-headline-sm text-headline-sm font-bold text-on-surface">Backend Event Stream</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleDownloadLogs} disabled={!exp} className="text-secondary hover:underline font-label-sm text-label-sm flex items-center gap-1 cursor-pointer disabled:opacity-40">
                  <span className="material-symbols-outlined text-[15px]">download</span>
                  <span>Save Log</span>
                </button>
                <button
                  onClick={() => setClearedAt(events.length ? events[events.length - 1].id : 0)}
                  className="text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm underline cursor-pointer"
                >
                  Clear view
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 mt-3 flex-wrap">
              <div className="flex items-center gap-1 text-xs">
                {(['all', 'round', 'node', 'server', 'fedavg'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setLogFilter(cat)}
                    className={`px-2.5 py-1 rounded-lg uppercase font-bold text-[10px] transition-colors cursor-pointer ${
                      logFilter === cat ? 'bg-secondary text-on-secondary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Filter logs..."
                aria-label="Filter logs"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="px-2.5 py-1 bg-surface-container rounded-lg text-xs font-mono outline-none text-on-surface placeholder:text-on-surface-variant"
              />
            </div>
            <div ref={terminalRef} className="my-3 bg-surface-container-highest text-on-surface font-mono p-space-sm rounded-xl h-64 overflow-y-auto space-y-1.5 shadow-inner border border-surface-container">
              {filteredLogs.length === 0 ? (
                <div className="text-on-surface-variant text-center py-8 text-[12px]">{exp ? 'No matching events.' : 'Events from the backend appear here once an experiment starts.'}</div>
              ) : (
                filteredLogs.map((log) => (
                  <div key={log.id} className="text-on-surface-variant text-[11px] leading-relaxed">
                    [{new Date(log.ts).toLocaleTimeString()}] <span className={prefixClass(log.level)}>{log.prefix}</span> <span>{log.text}</span>
                  </div>
                ))
              )}
            </div>
            <div className="flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant pt-1 border-t border-surface-container">
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${live ? 'bg-on-tertiary-container animate-pulse' : 'bg-outline'}`}></span>
                {exp ? `GET /api/experiments/${exp.id}/events` : 'idle'}
              </span>
              <span>{filteredLogs.length} events shown</span>
            </div>
          </div>

          <div className={`lg:col-span-5 ${card} flex flex-col`}>
            <div className="flex items-center justify-between pb-space-sm border-b border-surface-container">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[22px]">verified</span>
                <span className="font-headline-sm text-headline-sm font-bold text-on-surface">Run Checks</span>
              </div>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-2">Checked against the active experiment's stored record.</p>
            <div className="my-3 space-y-2.5 font-label-sm text-label-sm">
              {[
                { ok: clients.length >= 2, title: 'At least 2 clients', desc: clients.length ? `${clients.length} clients with ${clients.reduce((a, c) => a + c.num_sensors, 0)} disjoint sensors.` : 'No federated run yet.' },
                { ok: (exp?.completed_rounds ?? 0) >= 1, title: 'At least one completed round', desc: exp ? `${exp.completed_rounds} completed of ${exp.current_round} attempted.` : 'No run yet.' },
                { ok: dataset?.splits.order === 'chronological', title: 'Chronological train/val/test split', desc: dataset ? `Train ${dataset.splits.train.start.slice(0, 10)} → test ends ${dataset.splits.test.end.slice(0, 10)}.` : 'No run yet.' },
                { ok: !!fed && fed.uplink_payload.startsWith('model update'), title: 'Only model updates are uploaded', desc: fed ? `Uplink: ${fed.uplink_payload}. Raw records stay on clients (${formatBytes(fed.raw_training_bytes_total)}).` : 'No run yet.' },
                { ok: exp?.status === 'completed', title: 'Final test metrics computed', desc: exp?.status === 'completed' ? `Test MAE ${fmt(exp.metrics?.mae)} / RMSE ${fmt(exp.metrics?.rmse)} ${metricUnit}.` : 'Available after the experiment completes.' },
              ].map((c) => (
                <div key={c.title} className="flex items-start gap-2.5 bg-surface-container-low p-2.5 rounded-xl border border-surface-container">
                  <span className={`material-symbols-outlined text-[18px] mt-0.5 ${c.ok ? 'text-on-tertiary-container' : 'text-on-surface-variant'}`} aria-label={c.ok ? 'passed' : 'pending'}>
                    {c.ok ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                  <div>
                    <span className="font-bold text-on-surface block">
                      {c.title} <span className="font-normal text-on-surface-variant">({c.ok ? 'passed' : 'pending'})</span>
                    </span>
                    <span className="text-on-surface-variant">{c.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
