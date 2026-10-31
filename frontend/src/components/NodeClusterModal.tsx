import React from 'react';
import { useApp } from '../context/AppContext';
import { formatBytes } from '../api/client';
import { PALETTE } from './charts';

/** Inspector for the clients of the active experiment (all values from the backend). */
export const NodeClusterModal: React.FC = () => {
  const { isNodeClusterModalOpen, setIsNodeClusterModalOpen, activeExperiment: exp, activeRounds, setActiveTab } = useApp();
  if (!isNodeClusterModalOpen) return null;

  const fed = exp?.summary?.federation;
  const clients = fed?.clients ?? [];
  const last = activeRounds.length ? activeRounds[activeRounds.length - 1] : null;
  const participation = clients.map((c) => activeRounds.filter((r) => r.successful_clients.includes(c.client_id)).length);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="client-inspector-title">
      <div className="fixed inset-0 -z-10" onClick={() => setIsNodeClusterModalOpen(false)} />
      <div className="w-full max-w-3xl bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-space-lg py-space-md bg-surface-container-low flex items-center justify-between border-b border-surface-container">
          <div className="flex items-center gap-space-sm">
            <div className="w-9 h-9 rounded-lg bg-secondary/15 text-secondary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">hub</span>
            </div>
            <div>
              <h2 id="client-inspector-title" className="font-headline-sm text-headline-sm font-bold text-on-surface">Client Inspector</h2>
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                {exp ? `${exp.name} • round ${exp.current_round}/${exp.total_rounds}` : 'No active experiment'}
              </p>
            </div>
          </div>
          <button onClick={() => setIsNodeClusterModalOpen(false)} className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container cursor-pointer" aria-label="Close">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {!fed ? (
          <div className="p-space-lg text-center font-body-md text-body-md text-on-surface-variant">
            {exp?.mode === 'centralized' ? 'The active experiment is a centralized baseline and has no federated clients.' : 'Start a federated experiment to see its clients here.'}
            <div>
              <button
                onClick={() => {
                  setIsNodeClusterModalOpen(false);
                  setActiveTab('federated-simulator');
                }}
                className="mt-space-sm px-3 py-1.5 bg-secondary text-on-secondary rounded-xl font-label-md text-label-md font-bold cursor-pointer"
              >
                Open simulator
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm p-space-md border-b border-surface-container">
              <div className="bg-surface-container-low p-space-sm rounded-xl">
                <span className="font-label-sm text-label-sm text-on-surface-variant block">Clients</span>
                <span className="font-headline-md text-headline-md font-bold text-on-surface">{clients.length}</span>
              </div>
              <div className="bg-surface-container-low p-space-sm rounded-xl">
                <span className="font-label-sm text-label-sm text-on-surface-variant block">Training windows (N)</span>
                <span className="font-headline-md text-headline-md font-bold text-on-surface font-mono">{clients.reduce((a, c) => a + c.train_windows, 0).toLocaleString()}</span>
              </div>
              <div className="bg-surface-container-low p-space-sm rounded-xl">
                <span className="font-label-sm text-label-sm text-on-surface-variant block">Last round</span>
                <span className="font-headline-md text-headline-md font-bold text-on-surface font-mono">
                  {last ? `${last.successful_clients.length}/${last.participants.length} ok` : '—'}
                </span>
              </div>
              <div className="bg-surface-container-low p-space-sm rounded-xl">
                <span className="font-label-sm text-label-sm text-on-surface-variant block">Participation / dropout</span>
                <span className="font-headline-md text-headline-md font-bold text-on-surface font-mono">
                  {Math.round(exp!.config.client_fraction * 100)}% / {Math.round(exp!.config.client_dropout_prob * 100)}%
                </span>
              </div>
            </div>
            <div className="overflow-y-auto p-space-md space-y-space-sm flex-1">
              {clients.map((c, i) => {
                const loss = last?.client_losses?.[String(c.client_id)];
                return (
                  <div key={c.client_id} className="bg-surface-container-low p-space-md rounded-xl border border-surface-container">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }}></span>
                        <span className="font-label-md text-label-md font-bold text-on-surface">{c.name}</span>
                        <span className="font-label-sm text-label-sm text-on-surface-variant">{c.num_sensors} sensors</span>
                      </div>
                      <span className="font-mono font-label-sm text-label-sm text-secondary font-bold">weight {(c.fedavg_weight * 100).toFixed(1)}%</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2 font-label-sm text-label-sm text-on-surface-variant">
                      <div>Train windows<br /><span className="font-mono font-bold text-on-surface">{c.train_windows.toLocaleString()}</span></div>
                      <div>Mean {exp!.config.target}<br /><span className="font-mono font-bold text-on-surface">{c.mean_target.toFixed(1)}</span></div>
                      <div>Rounds uploaded<br /><span className="font-mono font-bold text-on-surface">{participation[i]}/{activeRounds.length}</span></div>
                      <div>Last local loss<br /><span className="font-mono font-bold text-on-surface">{loss !== undefined && loss !== null ? loss.toFixed(4) : '—'}</span></div>
                      <div>Raw kept local<br /><span className="font-mono font-bold text-on-tertiary-container">{formatBytes(c.raw_training_bytes_kept_local)}</span></div>
                    </div>
                    <div className="mt-2 font-mono text-[11px] text-on-surface-variant break-words">Sensor indices: {c.sensors.join(', ')}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
