import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { api, Communication, downloadText, downloadUrl, Experiment, fmt, formatBytes } from '../api/client';
import { EmptyState, LineChart, OfflineBanner, PALETTE, ScatterChart, StatusBadge } from '../components/charts';

const card = 'bg-surface-container-lowest p-space-lg rounded-2xl shadow-sm border border-surface-container/70';
const wrap = 'w-full px-space-md lg:px-space-margin-desktop pb-space-lg max-w-[1720px] mx-auto';

export const sameProtocol = (a: Experiment, b: Experiment) =>
  (['dataset_id', 'target', 'horizon', 'input_len', 'num_sensors', 'seed', 'train_frac', 'val_frac'] as const).every((k) => a.config[k] === b.config[k]);

const encLabel = (e: Experiment) => {
  if (e.mode === 'centralized') return 'Centralized (raw upload)';
  const c = e.config;
  const enc = c.uplink_encoding === 'topk' ? `Top-k ${(c.topk_ratio * 100).toFixed(0)}%` : c.uplink_encoding.toUpperCase();
  const extras = [c.client_fraction < 1 ? `C=${c.client_fraction}` : null, c.local_epochs > 1 ? `E=${c.local_epochs}` : null, `${c.rounds} rds`].filter(Boolean);
  return `${enc} ${extras.join(' ')}`;
};

export const CommunicationAnalysis: React.FC = () => {
  const { backendOnline, experiments, activeExperimentId, addToast, setActiveTab } = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comm, setComm] = useState<Communication | null>(null);
  const [showClientRows, setShowClientRows] = useState(false);
  const [showLatex, setShowLatex] = useState(false);

  const fedRuns = experiments.filter((e) => e.mode === 'federated');
  const selected = experiments.find((e) => e.id === (selectedId ?? activeExperimentId)) ?? fedRuns.find((e) => e.status === 'completed') ?? experiments[0] ?? null;

  useEffect(() => {
    setComm(null);
    if (!selected) return;
    api.communication(selected.id).then(setComm).catch(() => setComm(null));
  }, [selected?.id, selected?.status, selected?.current_round]);

  const comparable = useMemo(
    () => (selected ? experiments.filter((e) => e.status === 'completed' && e.metrics && sameProtocol(e, selected)) : []),
    [experiments, selected]
  );
  const central = comparable.find((e) => e.mode === 'centralized');
  const m = selected?.metrics;
  const totals = comm?.totals;
  const rawLocal = selected?.summary?.federation?.raw_training_bytes_total ?? (m ? m.raw_training_bytes_kept_local : undefined);

  // Encoding inspector: measured per-client uplink payload by encoding among comparable completed runs
  const encodings = (['fp32', 'fp16', 'int8', 'topk'] as const).map((enc) => {
    const run = comparable.find((e) => e.mode === 'federated' && e.config.uplink_encoding === enc);
    const mm = run?.metrics;
    const uploads = run ? run.completed_rounds && mm ? mm.total_upload_bytes : null : null;
    const perUpload = run && mm ? mm.total_upload_bytes / Math.max(1, mm.completed_rounds * Math.round(run.config.client_fraction * run.config.num_clients)) : null;
    return { enc, run, perUpload, ratio: mm?.uplink_compression_ratio ?? null, mae: mm?.mae ?? null, uploads };
  });
  const fp32Upload = encodings[0].perUpload;

  const latex = useMemo(() => {
    if (!comparable.length) return '';
    const base = comparable.find((e) => e.mode === 'federated' && e.config.uplink_encoding === 'fp32' && e.config.client_fraction === 1) ?? comparable[0];
    const bb = base.metrics!.total_communication_bytes;
    const rows = comparable
      .map((e) => {
        const mm = e.metrics!;
        const red = e.id === base.id ? 'Baseline' : `${((1 - mm.total_communication_bytes / bb) * 100).toFixed(1)}\\%`;
        return `${encLabel(e).replace(/%/g, '\\%')} & ${(mm.total_communication_bytes / 1024 ** 2).toFixed(2)} MB & ${mm.mae.toFixed(2)} & ${mm.rmse.toFixed(2)} & ${mm.completed_rounds} & ${red} \\\\`;
      })
      .join('\n');
    const unit = comparable[0].metrics!.unit;
    return `\\begin{table}[htbp]
\\centering
\\caption{Communication cost vs. test error (${comparable[0].config.dataset_id.toUpperCase()} ${comparable[0].config.target}, ${comparable[0].metrics!.horizon_minutes}-min horizon, seed ${comparable[0].config.seed}). Bytes are serialized payload sizes.}
\\begin{tabular}{lccccc}
\\toprule
\\textbf{Configuration} & \\textbf{Total bytes} & \\textbf{MAE (${unit})} & \\textbf{RMSE} & \\textbf{Rounds} & \\textbf{Comm. change vs ${encLabel(base).replace(/%/g, '\\%')}} \\\\
\\midrule
${rows}
\\bottomrule
\\end{tabular}
\\end{table}`;
  }, [comparable]);

  const runSuite = async () => {
    if (!selected) return;
    try {
      const base = { ...selected.config, name: null, start_paused: false };
      const r = await api.suite(base, ['CENTRAL', 'A', 'B', 'C', 'C2', 'D'], `suite-${selected.id}-${Date.now()}`);
      addToast('Evaluation Suite Queued', `${r.experiments.length} experiments queued with the same data protocol. Track them in Experiments.`, 'success');
      setActiveTab('experiments');
    } catch (e: any) {
      addToast('Could Not Queue Suite', e.message ?? String(e), 'error');
    }
  };

  return (
    <div className="flex flex-col w-full animate-fade-in">
      <div className="w-full px-space-md lg:px-space-margin-desktop py-space-lg flex flex-col md:flex-row md:items-end justify-between gap-space-md max-w-[1720px] mx-auto">
        <div>
          <div className="flex items-center gap-space-xs text-secondary font-label-sm text-label-sm uppercase tracking-wider mb-1 font-bold">
            <span className="w-2 h-2 rounded-full bg-secondary"></span>
            <span>Measured payload accounting</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight font-bold">Communication vs. Accuracy Trade-off</h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl mt-1 leading-relaxed">
            Every byte here comes from the backend ledger: the serialized size of each model broadcast and client update. Read communication together with test error; less traffic is not automatically a better result.
          </p>
        </div>
        <div className="flex items-center gap-space-sm shrink-0 flex-wrap">
          <label className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
            Experiment
            <select
              value={selected?.id ?? ''}
              onChange={(e) => setSelectedId(e.target.value)}
              className="bg-surface-container text-on-surface font-label-sm text-label-sm px-space-sm py-1.5 rounded-xl border border-surface-container-high max-w-[260px] cursor-pointer"
            >
              {experiments.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.status})
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => setShowLatex(true)}
            disabled={!latex}
            className="flex items-center gap-space-xs px-space-md py-space-sm bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md rounded-xl transition-colors cursor-pointer border border-surface-container-high font-bold disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[16px] text-secondary">code_blocks</span>
            <span>Export LaTeX</span>
          </button>
          <button
            onClick={() => selected && downloadUrl(api.exportUrl(selected.id, 'csv', 'ledger'))}
            disabled={!selected}
            className="flex items-center gap-space-xs px-space-md py-space-sm bg-primary text-on-primary font-label-md text-label-md rounded-xl shadow-sm hover:opacity-90 transition-opacity cursor-pointer font-bold disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            <span>Ledger CSV</span>
          </button>
        </div>
      </div>

      <OfflineBanner online={backendOnline} />

      {!selected ? (
        <div className={wrap}>
          <EmptyState icon="query_stats" title="No experiments yet" action={<button onClick={() => setActiveTab('federated-simulator')} className="mt-2 px-3 py-1.5 bg-secondary text-on-secondary rounded-xl font-label-md text-label-md font-bold cursor-pointer">Go to simulator</button>}>
            Run a federated experiment to record its communication ledger.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className={wrap}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-space-md">
              <div className={`${card} flex flex-col justify-between`}>
                <div className="flex items-center justify-between text-on-surface-variant">
                  <span className="font-label-sm text-label-sm uppercase font-bold">Total communication</span>
                  <StatusBadge status={selected.status} paused={selected.paused} />
                </div>
                <div className="mt-space-md font-headline-lg text-headline-lg text-on-surface font-bold font-mono">{formatBytes(totals?.total_bytes)}</div>
                <div className="mt-space-md pt-space-xs flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant border-t border-surface-container">
                  <span>Up {formatBytes(totals?.upload_bytes)}</span>
                  <span>Down {formatBytes(totals?.download_bytes)}</span>
                </div>
              </div>

              <div className={`${card} flex flex-col justify-between`}>
                <div className="flex items-center justify-between text-on-surface-variant">
                  <span className="font-label-sm text-label-sm uppercase font-bold">Raw training records</span>
                  <span className="material-symbols-outlined text-[20px] text-error">cloud_sync</span>
                </div>
                <div className="mt-space-md font-headline-lg text-headline-lg text-on-surface font-bold font-mono">
                  {formatBytes(selected.mode === 'centralized' ? totals?.upload_bytes : rawLocal)}
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                  {selected.mode === 'centralized' ? 'Uploaded once to the central server (float32, all features).' : 'Never transmitted: kept on the clients (float32, all features, training period).'}
                </p>
              </div>

              <div className="bg-gradient-to-tr from-primary to-[#18233c] text-on-primary p-space-lg rounded-2xl shadow-md flex flex-col justify-between border border-secondary/20">
                <div className="flex items-center justify-between text-primary-fixed-dim">
                  <span className="font-label-sm text-label-sm uppercase font-bold">vs. centralized upload</span>
                  <span className="material-symbols-outlined text-[20px] text-tertiary-fixed">eco</span>
                </div>
                {central?.metrics && m && selected.mode === 'federated' ? (
                  <>
                    <div className="mt-space-md font-headline-xl text-headline-xl text-tertiary-fixed font-bold tracking-tight font-mono">
                      {(m.total_communication_bytes / central.metrics.total_communication_bytes).toFixed(2)}×
                    </div>
                    <p className="font-body-sm text-body-sm text-inverse-primary mt-1">
                      FL traffic ÷ raw-data upload ({formatBytes(central.metrics.total_communication_bytes)}). MAE {fmt(m.mae)} vs {fmt(central.metrics.mae)}.
                    </p>
                  </>
                ) : (
                  <p className="font-body-sm text-body-sm text-inverse-primary mt-space-md">
                    {selected.mode === 'centralized'
                      ? 'This is the centralized baseline.'
                      : 'Needs a completed centralized baseline with the same data protocol (dataset, target, horizon, sensors, seed).'}
                  </p>
                )}
              </div>

              <div className={`${card} flex flex-col justify-between`}>
                <div className="flex items-center justify-between text-on-surface-variant">
                  <span className="font-label-sm text-label-sm uppercase font-bold">Uplink compression</span>
                  <span className="material-symbols-outlined text-[20px] text-on-tertiary-container">compress</span>
                </div>
                <div className="mt-space-md font-headline-lg text-headline-lg text-on-surface font-bold font-mono">
                  {totals && totals.upload_bytes ? `${(totals.raw_upload_bytes / totals.upload_bytes).toFixed(2)}×` : '—'}
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                  fp32-equivalent ÷ transmitted uplink bytes ({selected.config.uplink_encoding}
                  {selected.config.uplink_encoding === 'topk' ? ` ${selected.config.topk_ratio * 100}%` : ''}).
                </p>
              </div>
            </div>
          </div>

          {/* Encoding inspector */}
          <div className={wrap}>
            <div className={`${card} flex flex-col gap-space-md`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-space-sm border-b border-surface-container gap-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-[22px]">compress</span>
                  <div>
                    <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">Update Encoding Comparison (measured)</h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">Completed runs with the same data protocol as the selected experiment. Payload sizes include the payload header.</p>
                  </div>
                </div>
                <button onClick={runSuite} disabled={backendOnline === false} className="px-3 py-1.5 bg-secondary text-on-secondary rounded-xl font-label-md text-label-md font-bold cursor-pointer disabled:opacity-40">
                  Run evaluation suite (A–D + centralized)
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-sm">
                {encodings.map(({ enc, run, perUpload, ratio, mae }) => (
                  <div key={enc} className="bg-surface-container-low p-space-sm rounded-xl border border-surface-container">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-on-surface uppercase font-mono">{enc === 'topk' ? 'Top-k' : enc}</span>
                      {run ? <span className="font-label-sm text-label-sm text-on-tertiary-container font-bold">measured</span> : <span className="font-label-sm text-label-sm text-on-surface-variant">not run</span>}
                    </div>
                    {run ? (
                      <div className="mt-2 space-y-1 font-label-sm text-label-sm text-on-surface-variant">
                        <div className="flex justify-between"><span>Per-client upload</span><span className="font-mono font-bold text-secondary">{formatBytes(perUpload)}</span></div>
                        <div className="flex justify-between"><span>vs fp32 payload</span><span className="font-mono text-on-surface">{fp32Upload && perUpload ? `${((perUpload / fp32Upload) * 100).toFixed(1)}%` : '—'}</span></div>
                        <div className="flex justify-between"><span>Compression</span><span className="font-mono text-on-surface">{ratio ? `${ratio.toFixed(2)}×` : '—'}</span></div>
                        <div className="flex justify-between"><span>Test MAE</span><span className="font-mono text-on-surface">{fmt(mae)}</span></div>
                      </div>
                    ) : (
                      <p className="mt-2 font-label-sm text-label-sm text-on-surface-variant">No completed run with this encoding and the same protocol.</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Pareto + cumulative */}
          <div className={wrap}>
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg">
              <div className={`xl:col-span-6 ${card} flex flex-col`}>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">Test MAE vs Total Bytes</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-sm">Each point is a completed experiment with the same data protocol. Lower-left is better on both axes. Log scale on bytes.</p>
                <ScatterChart
                  points={comparable.map((e, i) => ({
                    x: e.metrics!.total_communication_bytes,
                    y: e.metrics!.mae,
                    label: e.suite_label ?? encLabel(e),
                    color: e.mode === 'centralized' ? '#0b1c30' : PALETTE[i % PALETTE.length],
                    highlight: e.id === selected.id,
                  }))}
                  xLabel="Total communication (bytes, log scale)"
                  yLabel={`Test MAE (${m?.unit ?? comparable[0]?.metrics?.unit ?? ''})`}
                  xFormat={(v) => formatBytes(v, 0)}
                  yFormat={(v) => v.toFixed(1)}
                  logX
                />
              </div>
              <div className={`xl:col-span-6 ${card} flex flex-col`}>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">Cumulative Bytes per Round</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-sm">From the round-level ledger of the selected experiment{comparable.length > 1 ? ' and comparable federated runs' : ''}.</p>
                <CumulativeChart selected={selected} comm={comm} others={comparable.filter((e) => e.mode === 'federated' && e.id !== selected.id).slice(0, 5)} />
              </div>
            </div>
          </div>

          {/* Ledger */}
          <div className={wrap}>
            <div className={`${card} flex flex-col`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between pb-space-md gap-space-xs border-b border-surface-container mb-space-sm">
                <div>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">Communication Ledger</h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{comm?.accounting?.description ?? 'Round-level records from the backend.'}</p>
                </div>
                <div className="flex items-center gap-2">
                  {comm?.ledger_matches_reported_totals !== null && comm && (
                    <span className={`font-label-sm text-label-sm px-2 py-1 rounded-lg font-bold ${comm.ledger_matches_reported_totals ? 'bg-on-tertiary-container/15 text-on-tertiary-container' : 'bg-error/15 text-error'}`}>
                      {comm.ledger_matches_reported_totals ? '✓ Ledger sum = reported total' : '✗ Ledger mismatch'}
                    </span>
                  )}
                  <button onClick={() => setShowClientRows(!showClientRows)} className="px-3 py-1 bg-surface-container rounded-lg font-label-sm text-label-sm font-bold text-on-surface cursor-pointer">
                    {showClientRows ? 'Show per round' : 'Show per client'}
                  </button>
                </div>
              </div>
              <div className="w-full overflow-x-auto max-h-[480px] overflow-y-auto">
                {!comm || (showClientRows ? !comm.ledger.length : !comm.rounds.length) ? (
                  <EmptyState title="No ledger entries yet">Entries are written as each round completes.</EmptyState>
                ) : showClientRows ? (
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0">
                      <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                        {['Round', 'Client', 'Download', 'Upload', 'fp32 equiv.', 'Type', 'Status', 'Local loss', 'Est. transfer'].map((h) => (
                          <th key={h} className="py-space-sm px-space-md font-bold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="font-label-md text-label-md text-on-surface divide-y divide-surface-container font-mono">
                      {comm.ledger.map((r, i) => (
                        <tr key={i} className="hover:bg-surface-container-low/50">
                          <td className="py-1.5 px-space-md">{r.round}</td>
                          <td className="py-1.5 px-space-md">{r.client_name}</td>
                          <td className="py-1.5 px-space-md">{formatBytes(r.download_bytes)}</td>
                          <td className="py-1.5 px-space-md">{formatBytes(r.upload_bytes)}</td>
                          <td className="py-1.5 px-space-md text-on-surface-variant">{formatBytes(r.raw_upload_bytes)}</td>
                          <td className="py-1.5 px-space-md">{r.transfer_type} / {r.uplink_encoding}</td>
                          <td className={`py-1.5 px-space-md font-bold ${r.status === 'ok' ? 'text-on-tertiary-container' : 'text-error'}`}>{r.status}</td>
                          <td className="py-1.5 px-space-md">{r.local_train_loss === null ? '—' : r.local_train_loss.toFixed(4)}</td>
                          <td className="py-1.5 px-space-md">{r.est_transfer_s.toFixed(2)} s</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0">
                      <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                        {['Round', 'Status', 'Clients ok / sampled', 'Download', 'Upload', 'Round total', 'Cumulative', 'Elapsed'].map((h) => (
                          <th key={h} className="py-space-sm px-space-md font-bold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="font-label-md text-label-md text-on-surface divide-y divide-surface-container font-mono">
                      {comm.rounds.map((r) => (
                        <tr key={r.round} className="hover:bg-surface-container-low/50">
                          <td className="py-1.5 px-space-md font-bold text-secondary">R-{r.round}</td>
                          <td className={`py-1.5 px-space-md font-bold ${r.status === 'completed' ? 'text-on-tertiary-container' : r.status === 'partial' ? 'text-amber-700' : 'text-error'}`}>{r.status}</td>
                          <td className="py-1.5 px-space-md">
                            {r.successful_clients?.length ?? 0} / {r.participants?.length ?? 0}
                          </td>
                          <td className="py-1.5 px-space-md">{formatBytes(r.download_bytes)}</td>
                          <td className="py-1.5 px-space-md">{formatBytes(r.upload_bytes)}</td>
                          <td className="py-1.5 px-space-md font-bold">{formatBytes(r.total_bytes)}</td>
                          <td className="py-1.5 px-space-md">{formatBytes(r.cumulative_bytes)}</td>
                          <td className="py-1.5 px-space-md">{r.elapsed_s?.toFixed(1)} s</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="mt-space-md pt-space-sm flex flex-col md:flex-row md:items-center justify-between text-on-surface-variant font-label-sm text-label-sm gap-space-xs border-t border-surface-container">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-[16px] text-secondary">info</span>
                  <span>Method: {comm?.accounting?.method ?? '—'}. {comm?.accounting?.estimated_transfer_time}</span>
                </div>
                <span className="font-mono">{totals ? `${totals.ledger_entries} entries • ${totals.completed_rounds} completed rounds` : ''}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {showLatex && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-space-md animate-fade-in" role="dialog" aria-modal="true">
          <div className="fixed inset-0 -z-10" onClick={() => setShowLatex(false)} />
          <div className="bg-surface-container-lowest w-full max-w-3xl rounded-2xl shadow-2xl border border-surface-container p-space-lg flex flex-col">
            <div className="flex items-center justify-between pb-space-sm mb-space-sm border-b border-surface-container">
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">LaTeX table (generated from completed experiments)</h3>
              <button onClick={() => setShowLatex(false)} className="text-on-surface-variant hover:text-on-surface cursor-pointer p-1 rounded-lg" aria-label="Close">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <pre className="bg-surface-container p-space-md rounded-xl font-mono text-label-sm text-on-surface overflow-x-auto select-all leading-relaxed border border-surface-container-high">{latex}</pre>
            <div className="mt-space-md flex items-center justify-end gap-2">
              <button onClick={() => downloadText('fedtraffic_table.tex', latex)} className="px-space-md py-1.5 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl font-label-md text-label-md font-bold cursor-pointer">
                Download .tex
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(latex).then(() => addToast('LaTeX Copied', 'Table copied to clipboard.', 'success'))}
                className="px-space-md py-1.5 bg-secondary text-on-secondary rounded-xl font-label-md text-label-md font-bold cursor-pointer"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const CumulativeChart: React.FC<{ selected: Experiment; comm: Communication | null; others: Experiment[] }> = ({ selected, comm, others }) => {
  const [otherRounds, setOtherRounds] = useState<Record<string, { round: number; cumulative_bytes: number }[]>>({});
  const key = others.map((o) => o.id).join(',');
  useEffect(() => {
    let alive = true;
    Promise.all(others.map((o) => api.rounds(o.id).then((r) => [o.id, r] as const)))
      .then((pairs) => alive && setOtherRounds(Object.fromEntries(pairs)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const MB = 1024 ** 2;
  return (
    <LineChart
      series={[
        { name: encLabel(selected), color: PALETTE[0], width: 2.5, points: (comm?.rounds ?? []).map((r) => ({ x: r.round!, y: (r.cumulative_bytes ?? 0) / MB })) },
        ...others.map((o, i) => ({
          name: o.suite_label ? `${o.suite_label}: ${encLabel(o)}` : encLabel(o),
          color: PALETTE[(i + 1) % PALETTE.length],
          points: (otherRounds[o.id] ?? []).map((r) => ({ x: r.round, y: r.cumulative_bytes / MB })),
        })),
      ]}
      xLabel="Round"
      yLabel="Cumulative MB"
      yFormat={(v) => v.toFixed(1)}
      emptyText="No rounds recorded yet"
    />
  );
};
