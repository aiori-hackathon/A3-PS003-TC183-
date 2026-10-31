import React, { useEffect, useMemo, useState } from 'react';
import { isActiveStatus, useApp } from '../context/AppContext';
import { api, ApiError, CompareResult, downloadText, downloadUrl, ExperimentConfig, fmt, fmtPct, formatBytes, Preset } from '../api/client';
import { EmptyState, OfflineBanner, StatusBadge } from '../components/charts';

const card = 'bg-surface-container-lowest p-space-lg rounded-2xl shadow-sm border border-surface-container/70';
const input = 'mt-1 w-full px-2 py-1.5 bg-surface-container rounded-lg font-mono text-on-surface outline-none focus:ring-2 focus:ring-secondary text-sm';
const SUITE_IDS = ['CENTRAL', 'A', 'B', 'C', 'C2', 'D', 'PROX'];

function validate(c: ExperimentConfig, sensorsAvailable?: number): string[] {
  const errs: string[] = [];
  if (sensorsAvailable && c.num_sensors > sensorsAvailable) errs.push(`Sensors must be ≤ ${sensorsAvailable} for this dataset.`);
  if (c.mode === 'federated' && c.num_clients > c.num_sensors) errs.push('Clients cannot exceed sensors (each client needs at least one sensor).');
  if (c.train_frac + c.val_frac > 0.95) errs.push('Train + validation fractions must leave at least 5% for testing.');
  if (c.rounds < 1) errs.push('Rounds must be at least 1.');
  if (c.horizon < 1 || c.horizon > 24) errs.push('Horizon must be between 1 and 24 steps.');
  if (c.learning_rate <= 0) errs.push('Learning rate must be positive.');
  return errs;
}

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <label className="block font-label-sm text-label-sm text-on-surface-variant">
    <span className="font-bold text-on-surface">{label}</span>
    {children}
    {hint && <span className="block text-[11px] mt-0.5">{hint}</span>}
  </label>
);

export const Experiments: React.FC = () => {
  const { backendOnline, datasets, experiments, refreshExperiments, selectExperiment, activeExperimentId, setActiveTab, addToast } = useApp();
  const [defaults, setDefaults] = useState<ExperimentConfig | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [cfg, setCfg] = useState<ExperimentConfig | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [suiteSel, setSuiteSel] = useState<string[]>(['CENTRAL', 'A', 'B', 'C', 'C2', 'D']);
  const [selected, setSelected] = useState<string[]>([]);
  const [baseline, setBaseline] = useState<string | null>(null);
  const [comparison, setComparison] = useState<CompareResult | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'failed'>('all');

  useEffect(() => {
    api
      .presets()
      .then((p) => {
        setDefaults(p.defaults);
        setPresets(p.presets);
        setCfg((c) => c ?? { ...p.defaults });
      })
      .catch(() => undefined);
  }, [backendOnline]);

  const ds = datasets.find((d) => d.id === cfg?.dataset_id);
  const interval = ds?.interval_minutes ?? 5;
  const errors = cfg ? validate(cfg, ds?.num_sensors) : [];
  const set = <K extends keyof ExperimentConfig>(k: K, v: ExperimentConfig[K]) => setCfg((c) => (c ? { ...c, [k]: v } : c));
  const num = (k: keyof ExperimentConfig, parse: (s: string) => number = parseFloat) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, parse(e.target.value) as any);

  const submit = async () => {
    if (!cfg || errors.length) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const exp = await api.create({ ...cfg, name: cfg.name || null }, `form-${Date.now()}`);
      addToast('Experiment Queued', `${exp.name} (${exp.id})`, 'success');
      selectExperiment(exp.id);
      refreshExperiments();
    } catch (e) {
      setServerError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const submitSuite = async () => {
    if (!cfg || errors.length || !suiteSel.length) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const r = await api.suite({ ...cfg, name: null, start_paused: false }, suiteSel, `suite-${Date.now()}`);
      addToast('Suite Queued', `${r.experiments.length} experiments (suite ${r.suite_id}) will run one after another.`, 'success');
      refreshExperiments();
      setSelected(r.experiments.map((e) => e.id));
      setBaseline(r.experiments.find((e) => e.suite_label === 'A')?.id ?? r.experiments[0]?.id ?? null);
    } catch (e) {
      setServerError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const runCompare = async () => {
    try {
      setComparison(await api.compare(selected, baseline ?? undefined));
    } catch (e) {
      addToast('Comparison Failed', e instanceof ApiError ? e.message : String(e), 'error');
    }
  };

  useEffect(() => {
    if (selected.length >= 2) runCompare();
    else setComparison(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.join(','), baseline, experiments.filter((e) => selected.includes(e.id)).map((e) => e.status).join(',')]);

  const shown = useMemo(
    () =>
      experiments.filter((e) =>
        filter === 'all' ? true : filter === 'active' ? isActiveStatus(e.status) : filter === 'completed' ? e.status === 'completed' : e.status === 'failed' || e.status === 'cancelled'
      ),
    [experiments, filter]
  );

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      addToast(ok, '', 'info');
      refreshExperiments();
    } catch (e) {
      addToast('Action Failed', e instanceof ApiError ? e.message : String(e), 'error');
    }
  };

  return (
    <div className="flex flex-col w-full animate-fade-in">
      <div className="w-full px-space-md lg:px-space-margin-desktop py-space-lg max-w-[1720px] mx-auto">
        <div className="flex items-center gap-space-xs text-secondary font-label-sm text-label-sm uppercase tracking-wider mb-1 font-bold">
          <span className="w-2 h-2 rounded-full bg-secondary"></span>
          <span>Configure • run • compare • export</span>
        </div>
        <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight font-bold">Experiments</h1>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl mt-1 leading-relaxed">
          Each experiment is stored with its exact configuration, round history, communication ledger and event log. Settings of an existing experiment never change; editing the form creates a new experiment.
        </p>
      </div>

      <OfflineBanner online={backendOnline} />

      <div className="w-full px-space-md lg:px-space-margin-desktop pb-space-lg max-w-[1720px] mx-auto space-y-space-lg">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg">
          {/* Form */}
          <div className={`xl:col-span-7 ${card}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-space-sm border-b border-surface-container mb-space-md">
              <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">New experiment</h2>
              <div className="flex flex-wrap gap-1">
                <span className="font-label-sm text-label-sm text-on-surface-variant self-center mr-1">Load preset:</span>
                {presets.map((p) => (
                  <button key={p.id} title={p.description} onClick={() => setCfg({ ...p.config, start_paused: false })} className="px-2 py-0.5 rounded-lg bg-surface-container hover:bg-surface-container-high font-label-sm text-label-sm font-bold text-on-surface cursor-pointer">
                    {p.id}
                  </button>
                ))}
                {defaults && (
                  <button onClick={() => setCfg({ ...defaults })} className="px-2 py-0.5 rounded-lg bg-surface-container hover:bg-surface-container-high font-label-sm text-label-sm text-on-surface-variant cursor-pointer">
                    reset
                  </button>
                )}
              </div>
            </div>

            {!cfg ? (
              <EmptyState title="Loading defaults…">{backendOnline === false ? 'Backend offline.' : ''}</EmptyState>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
                className="space-y-space-md"
              >
                <fieldset className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <legend className="font-label-md text-label-md font-bold text-secondary mb-2 col-span-full">Data</legend>
                  <Field label="Name (optional)">
                    <input className={input} value={cfg.name ?? ''} onChange={(e) => set('name', e.target.value)} placeholder="auto" maxLength={120} />
                  </Field>
                  <Field label="Dataset">
                    <select className={input} value={cfg.dataset_id} onChange={(e) => {
                      const d = datasets.find((x) => x.id === e.target.value);
                      setCfg({ ...cfg, dataset_id: e.target.value, target: d?.features.includes(cfg.target) ? cfg.target : d?.features[0] ?? cfg.target, num_sensors: Math.min(cfg.num_sensors, d?.num_sensors ?? cfg.num_sensors) });
                    }}>
                      {datasets.map((d) => (
                        <option key={d.id} value={d.id} disabled={!d.available}>
                          {d.id}{d.is_synthetic ? ' (synthetic)' : ''}{!d.available ? ' (unavailable)' : ''}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Prediction target" hint={ds ? `unit: ${ds.units[cfg.target]}` : undefined}>
                    <select className={input} value={cfg.target} onChange={(e) => set('target', e.target.value)}>
                      {(ds?.features ?? [cfg.target]).map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Sensors" hint={ds?.num_sensors ? `of ${ds.num_sensors}, sampled by seed` : undefined}>
                    <input type="number" className={input} min={2} max={ds?.num_sensors} value={cfg.num_sensors} onChange={num('num_sensors', (s) => parseInt(s || '0', 10))} />
                  </Field>
                  <Field label="Input window" hint={`${cfg.input_len * interval} min`}>
                    <input type="number" className={input} min={3} max={48} value={cfg.input_len} onChange={num('input_len', (s) => parseInt(s || '0', 10))} />
                  </Field>
                  <Field label="Horizon (steps)" hint={`${cfg.horizon * interval} min ahead`}>
                    <input type="number" className={input} min={1} max={24} value={cfg.horizon} onChange={num('horizon', (s) => parseInt(s || '0', 10))} />
                  </Field>
                  <Field label="Train fraction">
                    <input type="number" step="0.05" className={input} min={0.1} max={0.9} value={cfg.train_frac} onChange={num('train_frac')} />
                  </Field>
                  <Field label="Validation fraction">
                    <input type="number" step="0.05" className={input} min={0.05} max={0.4} value={cfg.val_frac} onChange={num('val_frac')} />
                  </Field>
                </fieldset>

                <fieldset className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <legend className="font-label-md text-label-md font-bold text-secondary mb-2 col-span-full">Training</legend>
                  <Field label="Mode">
                    <select className={input} value={cfg.mode} onChange={(e) => set('mode', e.target.value as any)}>
                      <option value="federated">Federated</option>
                      <option value="centralized">Centralized baseline</option>
                    </select>
                  </Field>
                  <Field label={cfg.mode === 'federated' ? 'Rounds' : 'Evaluation epochs'}>
                    <input type="number" className={input} min={1} max={500} value={cfg.rounds} onChange={num('rounds', (s) => parseInt(s || '0', 10))} />
                  </Field>
                  <Field label="Local epochs">
                    <input type="number" className={input} min={1} max={50} value={cfg.local_epochs} onChange={num('local_epochs', (s) => parseInt(s || '0', 10))} />
                  </Field>
                  <Field label="Steps per epoch" hint="mini-batches (cap)">
                    <input type="number" className={input} min={1} max={5000} value={cfg.max_local_steps} onChange={num('max_local_steps', (s) => parseInt(s || '0', 10))} />
                  </Field>
                  <Field label="Batch size">
                    <input type="number" className={input} min={8} max={2048} value={cfg.batch_size} onChange={num('batch_size', (s) => parseInt(s || '0', 10))} />
                  </Field>
                  <Field label="Learning rate">
                    <input type="number" step="0.0005" className={input} min={0.00001} max={1} value={cfg.learning_rate} onChange={num('learning_rate')} />
                  </Field>
                  <Field label="GRU hidden size">
                    <input type="number" className={input} min={8} max={256} value={cfg.hidden_size} onChange={num('hidden_size', (s) => parseInt(s || '0', 10))} />
                  </Field>
                  <Field label="Random seed">
                    <input type="number" className={input} min={0} value={cfg.seed} onChange={num('seed', (s) => parseInt(s || '0', 10))} />
                  </Field>
                </fieldset>

                <fieldset className="grid grid-cols-2 md:grid-cols-4 gap-3" disabled={cfg.mode !== 'federated'}>
                  <legend className="font-label-md text-label-md font-bold text-secondary mb-2 col-span-full">
                    Federation {cfg.mode !== 'federated' && <span className="text-on-surface-variant font-normal">(clients define the data owners for the centralized upload)</span>}
                  </legend>
                  <Field label="Clients">
                    <input type="number" className={input} min={2} max={50} value={cfg.num_clients} onChange={num('num_clients', (s) => parseInt(s || '0', 10))} />
                  </Field>
                  <Field label="Partition">
                    <select className={input} value={cfg.partition} onChange={(e) => set('partition', e.target.value as any)}>
                      <option value="contiguous">contiguous</option>
                      <option value="iid">iid</option>
                      <option value="dirichlet">dirichlet</option>
                    </select>
                  </Field>
                  <Field label="Dirichlet α">
                    <input type="number" step="0.1" className={input} min={0.01} disabled={cfg.partition !== 'dirichlet'} value={cfg.alpha} onChange={num('alpha')} />
                  </Field>
                  <Field label="Aggregation">
                    <select className={input} value={cfg.aggregation} onChange={(e) => set('aggregation', e.target.value as any)}>
                      <option value="fedavg">FedAvg</option>
                      <option value="fedprox">FedProx</option>
                    </select>
                  </Field>
                  <Field label="Participation fraction">
                    <input type="number" step="0.1" className={input} min={0.1} max={1} value={cfg.client_fraction} onChange={num('client_fraction')} />
                  </Field>
                  <Field label="Dropout probability" hint="simulated lost uploads">
                    <input type="number" step="0.05" className={input} min={0} max={0.95} value={cfg.client_dropout_prob} onChange={num('client_dropout_prob')} />
                  </Field>
                  <Field label="Uplink encoding">
                    <select className={input} value={cfg.uplink_encoding} onChange={(e) => set('uplink_encoding', e.target.value as any)}>
                      <option value="fp32">fp32</option>
                      <option value="fp16">fp16</option>
                      <option value="int8">int8</option>
                      <option value="topk">top-k</option>
                    </select>
                  </Field>
                  <Field label="Top-k ratio">
                    <input type="number" step="0.01" className={input} min={0.001} max={1} disabled={cfg.uplink_encoding !== 'topk'} value={cfg.topk_ratio} onChange={num('topk_ratio')} />
                  </Field>
                  <Field label="Downlink encoding">
                    <select className={input} value={cfg.downlink_encoding} onChange={(e) => set('downlink_encoding', e.target.value as any)}>
                      <option value="fp32">fp32</option>
                      <option value="fp16">fp16</option>
                      <option value="int8">int8</option>
                    </select>
                  </Field>
                  <Field label="FedProx μ">
                    <input type="number" step="0.01" className={input} min={0} disabled={cfg.aggregation !== 'fedprox'} value={cfg.prox_mu} onChange={num('prox_mu')} />
                  </Field>
                  <Field label="Uplink kbps" hint="for time estimates">
                    <input type="number" className={input} min={1} value={cfg.uplink_kbps} onChange={num('uplink_kbps')} />
                  </Field>
                  <Field label="Error feedback" hint="top-k only">
                    <select className={input} value={String(cfg.error_feedback)} disabled={cfg.uplink_encoding !== 'topk'} onChange={(e) => set('error_feedback', e.target.value === 'true')}>
                      <option value="true">on</option>
                      <option value="false">off</option>
                    </select>
                  </Field>
                </fieldset>

                {(errors.length > 0 || serverError) && (
                  <div className="p-space-sm rounded-xl bg-error/10 border border-error/30 text-error font-label-md text-label-md space-y-1" role="alert">
                    {errors.map((e) => (
                      <div key={e}>• {e}</div>
                    ))}
                    {serverError && <div>• Backend: {serverError}</div>}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-surface-container">
                  <button type="submit" disabled={submitting || errors.length > 0 || backendOnline === false} className="px-space-md py-2 bg-primary text-on-primary rounded-xl font-label-md text-label-md font-bold cursor-pointer disabled:opacity-40">
                    {submitting ? 'Submitting…' : 'Run experiment'}
                  </button>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">or run a suite with this as the base:</span>
                  {SUITE_IDS.map((id) => (
                    <label key={id} className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface cursor-pointer" title={presets.find((p) => p.id === id)?.description}>
                      <input type="checkbox" checked={suiteSel.includes(id)} onChange={(e) => setSuiteSel((s) => (e.target.checked ? [...s, id] : s.filter((x) => x !== id)))} className="accent-secondary" />
                      {id}
                    </label>
                  ))}
                  <button type="button" onClick={submitSuite} disabled={submitting || errors.length > 0 || !suiteSel.length || backendOnline === false} className="px-space-md py-2 bg-secondary text-on-secondary rounded-xl font-label-md text-label-md font-bold cursor-pointer disabled:opacity-40">
                    Run suite ({suiteSel.length})
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Presets explanation */}
          <div className={`xl:col-span-5 ${card}`}>
            <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface pb-space-sm border-b border-surface-container mb-space-sm">Evaluation plan (PRD §10)</h2>
            <div className="space-y-2">
              {presets.map((p) => (
                <div key={p.id} className="bg-surface-container-low p-space-sm rounded-xl">
                  <span className="font-label-md text-label-md font-bold text-on-surface">
                    <span className="font-mono text-secondary mr-1">{p.id}</span> {p.title}
                  </span>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">{p.description}</p>
                </div>
              ))}
              <p className="font-body-sm text-body-sm text-on-surface-variant pt-1">
                Suite runs share every data and evaluation setting with the form, so their results are directly comparable. They execute one at a time on the backend; this page updates automatically.
              </p>
            </div>
          </div>
        </div>

        {/* History */}
        <div className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2 pb-space-sm border-b border-surface-container mb-space-sm">
            <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">History ({experiments.length})</h2>
            <div className="flex items-center gap-1">
              {(['all', 'active', 'completed', 'failed'] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={`px-2.5 py-1 rounded-lg font-label-sm text-label-sm font-bold uppercase cursor-pointer ${filter === f ? 'bg-secondary text-on-secondary' : 'bg-surface-container text-on-surface-variant'}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          {!shown.length ? (
            <EmptyState icon="science" title="No experiments">Run one with the form above.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                    {['Compare', 'Baseline', 'Status', 'Name', 'Rounds', 'Test MAE', 'Test RMSE', 'Total bytes', 'Runtime', 'Created', 'Actions'].map((h) => (
                      <th key={h} className="py-space-sm px-2 font-bold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="font-label-md text-label-md text-on-surface divide-y divide-surface-container">
                  {shown.map((e) => (
                    <tr key={e.id} className={`${e.id === activeExperimentId ? 'bg-secondary/5' : ''} hover:bg-surface-container-low/50`}>
                      <td className="py-1.5 px-2">
                        <input type="checkbox" aria-label={`Compare ${e.name}`} className="accent-secondary" checked={selected.includes(e.id)} onChange={(ev) => setSelected((s) => (ev.target.checked ? [...s, e.id] : s.filter((x) => x !== e.id)))} />
                      </td>
                      <td className="py-1.5 px-2">
                        <input type="radio" name="baseline" aria-label={`Use ${e.name} as baseline`} className="accent-secondary" disabled={!selected.includes(e.id)} checked={baseline === e.id} onChange={() => setBaseline(e.id)} />
                      </td>
                      <td className="py-1.5 px-2"><StatusBadge status={e.status} paused={e.paused} /></td>
                      <td className="py-1.5 px-2 max-w-[340px]">
                        <div className="font-bold truncate" title={e.name}>
                          {e.suite_label && <span className="font-mono text-secondary mr-1">[{e.suite_label}]</span>}
                          {e.name}
                        </div>
                        <div className="font-mono text-[11px] text-on-surface-variant">
                          {e.id} • {e.config.dataset_id}/{e.config.target} • {e.mode}
                          {e.error && <span className="text-error" title={e.error}> • {e.error.slice(0, 60)}</span>}
                        </div>
                      </td>
                      <td className="py-1.5 px-2 font-mono">{e.completed_rounds}/{e.total_rounds}</td>
                      <td className="py-1.5 px-2 font-mono">{fmt(e.metrics?.mae)}</td>
                      <td className="py-1.5 px-2 font-mono">{fmt(e.metrics?.rmse)}</td>
                      <td className="py-1.5 px-2 font-mono">{formatBytes(e.metrics?.total_communication_bytes)}</td>
                      <td className="py-1.5 px-2 font-mono">{e.end_to_end_runtime_seconds ? `${e.end_to_end_runtime_seconds.toFixed(1)} s` : '—'}</td>
                      <td className="py-1.5 px-2 font-mono text-[11px] whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</td>
                      <td className="py-1.5 px-2 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button title="Open in simulator" onClick={() => { selectExperiment(e.id); setActiveTab('federated-simulator'); }} className="p-1 rounded hover:bg-surface-container cursor-pointer text-secondary">
                            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                          </button>
                          <button title="Export JSON" onClick={() => downloadUrl(api.exportUrl(e.id, 'json'))} className="p-1 rounded hover:bg-surface-container cursor-pointer">
                            <span className="material-symbols-outlined text-[18px]">data_object</span>
                          </button>
                          <button title="Export rounds CSV" onClick={() => downloadUrl(api.exportUrl(e.id, 'csv', 'rounds'))} className="p-1 rounded hover:bg-surface-container cursor-pointer">
                            <span className="material-symbols-outlined text-[18px]">table_view</span>
                          </button>
                          {isActiveStatus(e.status) ? (
                            <button title="Cancel" onClick={() => act(() => api.cancel(e.id), 'Cancellation requested')} className="p-1 rounded hover:bg-surface-container cursor-pointer text-error">
                              <span className="material-symbols-outlined text-[18px]">stop_circle</span>
                            </button>
                          ) : (
                            <button
                              title="Delete"
                              onClick={() => {
                                if (window.confirm(`Delete experiment "${e.name}" and all its records?`)) {
                                  act(() => api.remove(e.id), 'Experiment deleted');
                                  setSelected((s) => s.filter((x) => x !== e.id));
                                  if (activeExperimentId === e.id) selectExperiment(null);
                                }
                              }}
                              className="p-1 rounded hover:bg-surface-container cursor-pointer text-on-surface-variant"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Comparison */}
        <div className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2 pb-space-sm border-b border-surface-container mb-space-sm">
            <div>
              <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">Comparison</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Tick two or more experiments above and choose a baseline. Percentages are relative to the baseline.</p>
            </div>
            {comparison && (
              <div className="flex gap-2">
                <button onClick={() => downloadUrl(api.compareCsvUrl(selected, baseline ?? undefined))} className="px-3 py-1.5 bg-surface-container rounded-xl font-label-sm text-label-sm font-bold cursor-pointer">CSV</button>
                <button onClick={() => downloadText('comparison.json', JSON.stringify(comparison, null, 2), 'application/json')} className="px-3 py-1.5 bg-surface-container rounded-xl font-label-sm text-label-sm font-bold cursor-pointer">JSON</button>
              </div>
            )}
          </div>
          {!comparison ? (
            <EmptyState icon="compare" title="Select at least two experiments" />
          ) : (
            <>
              {comparison.issues.length > 0 && (
                <div className="mb-space-sm p-space-sm rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 font-label-md text-label-md space-y-1" role="status">
                  <strong>{comparison.comparable ? 'Notes' : 'Not directly comparable:'}</strong>
                  {comparison.issues.map((i, k) => (
                    <div key={k}>• {i.message}</div>
                  ))}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                      {['Experiment', 'Mode', 'Horizon', 'MAE', 'ΔMAE', 'RMSE', 'ΔRMSE', 'Total bytes', 'Δ bytes', 'Rounds', 'Runtime', 'Key settings'].map((h) => (
                        <th key={h} className="py-space-sm px-2 font-bold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="font-label-md text-label-md text-on-surface divide-y divide-surface-container font-mono">
                    {comparison.rows.map((r) => {
                      const cs = r.config_summary as any;
                      const commRed = r.communication_reduction_pct_vs_baseline;
                      return (
                        <tr key={r.experiment_id} className={r.is_baseline ? 'bg-secondary/5' : ''}>
                          <td className="py-1.5 px-2 font-body-sm font-bold max-w-[260px] truncate" title={r.name}>{r.is_baseline && '★ '}{r.name}</td>
                          <td className="py-1.5 px-2">{r.mode}</td>
                          <td className="py-1.5 px-2">{r.horizon_minutes} min</td>
                          <td className="py-1.5 px-2">{fmt(r.mae)}</td>
                          <td className={`py-1.5 px-2 ${(r.mae_change_pct_vs_baseline ?? 0) > 0 ? 'text-error' : 'text-on-tertiary-container'}`}>{r.is_baseline ? 'baseline' : fmtPct(r.mae_change_pct_vs_baseline)}</td>
                          <td className="py-1.5 px-2">{fmt(r.rmse)}</td>
                          <td className={`py-1.5 px-2 ${(r.rmse_change_pct_vs_baseline ?? 0) > 0 ? 'text-error' : 'text-on-tertiary-container'}`}>{r.is_baseline ? 'baseline' : fmtPct(r.rmse_change_pct_vs_baseline)}</td>
                          <td className="py-1.5 px-2">{formatBytes(r.total_communication_bytes)}</td>
                          <td className="py-1.5 px-2">{r.is_baseline ? 'baseline' : commRed === null || commRed === undefined ? '—' : fmtPct(-commRed)}</td>
                          <td className="py-1.5 px-2">{r.communication_rounds}</td>
                          <td className="py-1.5 px-2">{r.runtime_seconds ? `${r.runtime_seconds.toFixed(1)} s` : '—'}</td>
                          <td className="py-1.5 px-2 text-[11px] text-on-surface-variant whitespace-nowrap">
                            {cs.mode === 'centralized' ? 'centralized' : `${cs.num_clients}c ${cs.partition}${cs.partition === 'dirichlet' ? ` α${cs.alpha}` : ''} • ${cs.rounds}r E${cs.local_epochs} • ${cs.uplink_encoding}${cs.uplink_encoding === 'topk' ? ` ${cs.topk_ratio}` : ''} • C=${cs.client_fraction} • ${cs.aggregation}`} • seed {cs.seed}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-space-sm font-body-sm text-body-sm text-on-surface-variant">{comparison.note} Negative Δ bytes = less communication than the baseline; positive ΔMAE = worse accuracy.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
