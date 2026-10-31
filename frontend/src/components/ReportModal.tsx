import React from 'react';
import { useApp } from '../context/AppContext';
import { sound } from '../utils/audio';
import { api, downloadUrl, fmt, formatBytes } from '../api/client';

/** Printable summary of the active experiment, built only from stored backend results. */
export const ReportModal: React.FC = () => {
  const { isReportOpen, setIsReportOpen, activeExperiment: exp, experiments, addToast } = useApp();
  if (!isReportOpen) return null;

  const m = exp?.metrics;
  const s = exp?.summary;
  const completed = experiments.filter((e) => e.status === 'completed' && e.metrics);

  const row = (k: string, v: React.ReactNode) => (
    <tr key={k} className="border-b border-surface-container">
      <td className="py-1.5 pr-4 text-on-surface-variant">{k}</td>
      <td className="py-1.5 font-mono text-on-surface">{v}</td>
    </tr>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-2 sm:p-4 print:p-0 print:bg-white" role="dialog" aria-modal="true" aria-labelledby="report-title">
      <div className="fixed inset-0 -z-10 print:hidden" onClick={() => setIsReportOpen(false)} />
      <div className="w-full max-w-4xl bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container overflow-hidden flex flex-col max-h-[94vh] print:max-h-none print:shadow-none print:border-0">
        <div className="px-space-lg py-space-md bg-surface-container-low flex items-center justify-between border-b border-surface-container print:hidden">
          <h2 id="report-title" className="font-headline-sm text-headline-sm font-bold text-on-surface">Experiment Report</h2>
          <div className="flex items-center gap-2">
            <button
              disabled={!exp}
              onClick={() => {
                sound.playSuccess();
                downloadUrl(api.exportUrl(exp!.id, 'json'));
                addToast('Report Exported', 'Full experiment record (config, rounds, ledger, predictions, events) downloaded as JSON.', 'success');
              }}
              className="px-3 py-1.5 bg-surface-container rounded-xl font-label-md text-label-md font-bold cursor-pointer disabled:opacity-40"
            >
              JSON
            </button>
            <button disabled={!exp} onClick={() => downloadUrl(api.exportUrl(exp!.id, 'csv', 'ledger'))} className="px-3 py-1.5 bg-surface-container rounded-xl font-label-md text-label-md font-bold cursor-pointer disabled:opacity-40">
              Ledger CSV
            </button>
            <button onClick={() => window.print()} className="px-3 py-1.5 bg-secondary text-on-secondary rounded-xl font-label-md text-label-md font-bold cursor-pointer">
              Print
            </button>
            <button onClick={() => setIsReportOpen(false)} className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container cursor-pointer" aria-label="Close">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-space-lg space-y-space-md font-body-sm text-body-sm">
          {!exp ? (
            <p className="text-on-surface-variant">No experiment selected. Run or open one first.</p>
          ) : (
            <>
              <div>
                <h3 className="font-headline-md text-headline-md font-bold text-on-surface">{exp.name}</h3>
                <p className="text-on-surface-variant">
                  Experiment {exp.id} • status <strong>{exp.status}</strong> • created {new Date(exp.created_at).toLocaleString()}
                  {exp.completed_at && ` • finished ${new Date(exp.completed_at).toLocaleString()}`}
                </p>
                {exp.status !== 'completed' && (
                  <p className="mt-1 p-2 rounded-lg bg-amber-500/10 text-amber-900">This experiment has not completed; only partial (per-round validation) results exist. No final test metrics are reported.</p>
                )}
                {s?.dataset.is_synthetic && <p className="mt-1 p-2 rounded-lg bg-amber-500/10 text-amber-900">Dataset is synthetic: results do not describe real traffic.</p>}
              </div>

              <section>
                <h4 className="font-label-md text-label-md font-bold text-secondary uppercase mb-1">Results (held-out test set)</h4>
                <table className="w-full">
                  <tbody>
                    {row('MAE / RMSE / MAPE', m ? `${fmt(m.mae)} / ${fmt(m.rmse)} ${m.unit} / ${fmt(m.mape)}%` : '—')}
                    {row(`MAE / RMSE at ${m?.horizon_minutes ?? '—'} min only`, m ? `${fmt(m.mae_at_horizon)} / ${fmt(m.rmse_at_horizon)}` : '—')}
                    {row('Selected checkpoint', m ? `round ${m.selected_round} (best validation MAE)` : '—')}
                    {row('Completed / attempted rounds', `${exp.completed_rounds} / ${exp.total_rounds}`)}
                    {row('Upload / download / total bytes', m ? `${formatBytes(m.total_upload_bytes)} / ${formatBytes(m.total_download_bytes)} / ${formatBytes(m.total_communication_bytes)}` : '—')}
                    {row('Raw training data kept on clients', m ? formatBytes(m.raw_training_bytes_kept_local) : '—')}
                    {row('Training time / end-to-end runtime', m ? `${m.training_time_seconds.toFixed(1)} s / ${m.end_to_end_runtime_seconds.toFixed(1)} s` : '—')}
                  </tbody>
                </table>
              </section>

              {s && (
                <section>
                  <h4 className="font-label-md text-label-md font-bold text-secondary uppercase mb-1">Setup</h4>
                  <table className="w-full">
                    <tbody>
                      {row('Dataset', `${s.dataset.name} (sha256 ${s.dataset.sha256.slice(0, 12)}…)`)}
                      {row('Target / unit / interval', `${s.dataset.target} / ${s.dataset.unit} / ${s.dataset.interval_minutes} min`)}
                      {row('Sensors', `${s.dataset.sensors_used.length} (sampled with seed ${exp.config.seed})`)}
                      {row('Splits (chronological)', `train ${s.dataset.splits.train.start.slice(0, 10)}–${s.dataset.splits.train.end.slice(0, 10)}, val to ${s.dataset.splits.val.end.slice(0, 10)}, test to ${s.dataset.splits.test.end.slice(0, 10)}`)}
                      {row('Model', `${s.model.description}; ${s.model.parameters.toLocaleString()} parameters; ${s.model.optimizer}`)}
                      {s.federation && row('Federation', `${s.federation.clients.length} clients, ${s.federation.partition}${s.federation.alpha ? ` α=${s.federation.alpha}` : ''}, ${s.federation.aggregation}, uplink ${s.federation.uplink_encoding}, downlink ${s.federation.downlink_encoding}, participation ${exp.config.client_fraction}`)}
                      {row('Local training', `${exp.config.local_epochs} epoch(s) × ≤${exp.config.max_local_steps} steps, batch ${exp.config.batch_size}`)}
                      {row('Communication accounting', s.communication_accounting.description)}
                      {row('Software', Object.entries(s.environment).map(([k, v]) => `${k} ${v}`).join(', '))}
                    </tbody>
                  </table>
                  <ul className="list-disc pl-5 mt-2 text-on-surface-variant">
                    {s.dataset.preprocessing.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </section>
              )}

              {completed.length > 1 && (
                <section>
                  <h4 className="font-label-md text-label-md font-bold text-secondary uppercase mb-1">Other completed experiments</h4>
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-on-surface-variant">
                        <th className="py-1">Name</th>
                        <th>MAE</th>
                        <th>RMSE</th>
                        <th>Total bytes</th>
                        <th>Rounds</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {completed.slice(0, 15).map((e) => (
                        <tr key={e.id} className="border-b border-surface-container">
                          <td className="py-1 font-body-sm">{e.name}</td>
                          <td>{fmt(e.metrics!.mae)}</td>
                          <td>{fmt(e.metrics!.rmse)}</td>
                          <td>{formatBytes(e.metrics!.total_communication_bytes)}</td>
                          <td>{e.metrics!.completed_rounds}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}

              <section className="text-on-surface-variant">
                <h4 className="font-label-md text-label-md font-bold text-secondary uppercase mb-1">Limitations</h4>
                <ul className="list-disc pl-5">
                  <li>Clients are simulated in one process on one machine; transfer times are estimates from configured bandwidth, not network measurements.</li>
                  <li>Byte counts are serialized payload sizes and exclude protocol overhead (TCP/IP, TLS, HTTP).</li>
                  <li>Keeping raw data local is not a formal privacy guarantee: no secure aggregation or differential privacy is implemented.</li>
                </ul>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
