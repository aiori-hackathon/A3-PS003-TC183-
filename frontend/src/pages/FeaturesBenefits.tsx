import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

const card = 'bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm border border-surface-container/70';

const Term: React.FC<{ name: string; children: React.ReactNode }> = ({ name, children }) => (
  <div className="bg-surface-container-low p-space-sm rounded-xl border border-surface-container">
    <dt className="font-label-md text-label-md font-bold text-on-surface">{name}</dt>
    <dd className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{children}</dd>
  </div>
);

const REFERENCES = [
  { title: 'McMahan et al. (2017). Communication-Efficient Learning of Deep Networks from Decentralized Data (FedAvg). AISTATS.', url: 'https://arxiv.org/abs/1602.05629' },
  { title: 'Li et al. (2020). Federated Optimization in Heterogeneous Networks (FedProx). MLSys.', url: 'https://arxiv.org/abs/1812.06127' },
  { title: 'Hsu, Qi & Brown (2019). Measuring the Effects of Non-Identical Data Distribution for Federated Visual Classification (Dirichlet partitioning).', url: 'https://arxiv.org/abs/1909.06335' },
  { title: 'Stich, Cordonnier & Jaggi (2018). Sparsified SGD with Memory (top-k with error feedback). NeurIPS.', url: 'https://arxiv.org/abs/1809.07599' },
  { title: 'Guo et al. (2019). Attention Based Spatial-Temporal Graph Convolutional Networks for Traffic Flow Forecasting (PeMS04 release). AAAI.', url: 'https://ojs.aaai.org/index.php/AAAI/article/view/3881' },
  { title: 'Li et al. (2018). Diffusion Convolutional Recurrent Neural Network (METR-LA, DCRNN). ICLR.', url: 'https://arxiv.org/abs/1707.01926' },
  { title: 'Cho et al. (2014). Learning Phrase Representations using RNN Encoder–Decoder (GRU).', url: 'https://arxiv.org/abs/1406.1078' },
  { title: 'Caltrans Performance Measurement System (PeMS).', url: 'https://pems.dot.ca.gov/' },
  { title: 'Flower federated learning framework (alternative orchestration; not used in this prototype).', url: 'https://flower.ai/' },
];

export const FeaturesBenefits: React.FC = () => {
  const { datasets, backendOnline, addToast, setActiveTab } = useApp();
  const [copied, setCopied] = useState(false);
  const runCmd = 'cd backend && ./run.sh        # API on http://localhost:8000\ncd frontend && npm install && npm run dev   # dashboard on http://localhost:3000';

  return (
    <div className="flex flex-col w-full animate-fade-in">
      <div className="px-space-md lg:px-space-margin-desktop py-space-sm bg-surface-container-high border-b border-surface-container">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-xs max-w-[1720px] mx-auto w-full">
          <p className="font-label-md text-label-md font-bold tracking-tight text-on-surface">Methodology, limitations &amp; references</p>
          <span className="font-label-sm text-label-sm px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-800 font-bold">Status: research prototype (simulated clients on one machine)</span>
        </div>
      </div>

      <div className="p-space-md lg:p-space-margin-desktop space-y-space-lg max-w-[1720px] mx-auto w-full">
        <div className={card}>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight font-bold">How FedTraffic works</h1>
          <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed max-w-4xl mt-1">
            FedTraffic trains a traffic forecaster across several simulated roadside clients without moving their raw sensor readings, and records every byte the clients and server exchange. The same model can also be trained centrally on pooled data, so accuracy and communication can be compared under one evaluation protocol.
          </p>
          <ol className="mt-space-md grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-space-sm font-body-sm text-body-sm">
            {[
              ['1. Partition', 'Real sensors are split into disjoint groups, one per client.'],
              ['2. Broadcast', 'The server serializes the global model and sends it to the sampled clients.'],
              ['3. Local training', 'Each client trains on its own training windows only.'],
              ['4. Upload update', 'Clients send the weight change Δ (optionally fp16 / int8 / top-k).'],
              ['5. FedAvg', 'Server adds the n_k/N-weighted average of received updates.'],
              ['6. Evaluate & log', 'Validation MAE is computed and the round is written to the ledger.'],
            ].map(([t, d]) => (
              <li key={t} className="bg-surface-container-low p-space-sm rounded-xl border border-surface-container">
                <span className="font-bold text-on-surface block">{t}</span>
                <span className="text-on-surface-variant">{d}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-space-lg">
          <div className={card}>
            <h2 className="font-headline-md text-headline-md font-bold text-on-surface mb-space-sm">Key terms</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
              <Term name="Traffic forecasting">Predicting future sensor readings (e.g. vehicle flow in the next 60 minutes) from recent history.</Term>
              <Term name="Federated learning">Clients train locally and share model updates with a server instead of sharing their data.</Term>
              <Term name="Client">A simulated roadside unit owning a group of sensors and their data. It trains and uploads updates.</Term>
              <Term name="Server">Coordinates rounds, aggregates updates, and holds the global model. It never receives raw readings.</Term>
              <Term name="FedAvg">Global update = average of client updates weighted by each client's number of training windows (n_k / N).</Term>
              <Term name="FedProx">FedAvg plus a penalty keeping local models close to the global one; can help with non-IID data.</Term>
              <Term name="Communication round">One broadcast → local training → upload → aggregation cycle.</Term>
              <Term name="Non-IID">Clients see different data distributions. The Dirichlet α setting controls how uneven the split is.</Term>
              <Term name="MAE">Mean absolute error: average of |predicted − actual|, in the target's unit.</Term>
              <Term name="RMSE">Root mean squared error: like MAE but large errors count more.</Term>
              <Term name="MAPE">Mean absolute percentage error, |error| ÷ actual, over non-zero actual values.</Term>
              <Term name="Communication overhead">Bytes sent between clients and server: downloads of the global model plus uploads of updates.</Term>
            </dl>
          </div>

          <div className={card}>
            <h2 className="font-headline-md text-headline-md font-bold text-on-surface mb-space-sm">Experimental protocol</h2>
            <ul className="space-y-2 font-body-sm text-body-sm text-on-surface-variant list-disc pl-5">
              <li><strong className="text-on-surface">Model:</strong> 1-layer GRU (hidden 64 by default) + 2-layer MLP head, predicting every step up to the horizon at once. Identical architecture on every client, so parameters can be averaged directly.</li>
              <li><strong className="text-on-surface">Inputs:</strong> the last 12 readings (60 min at 5-min resolution) of one sensor, plus time-of-day (sin/cos) and a weekend flag.</li>
              <li><strong className="text-on-surface">Normalization:</strong> per-sensor z-score using that sensor's training-period values only, so no statistics are shared between clients.</li>
              <li><strong className="text-on-surface">Splits:</strong> chronological 70% / 15% / 15% (train / validation / test) by default. Windows never cross split boundaries.</li>
              <li><strong className="text-on-surface">Missing data:</strong> zero readings are treated as missing; they are excluded from normalization statistics, the training loss and all metrics.</li>
              <li><strong className="text-on-surface">Model selection:</strong> the round with the lowest validation MAE is chosen; the test set is used once, at the end, for that checkpoint.</li>
              <li><strong className="text-on-surface">Metrics:</strong> MAE / RMSE / MAPE averaged over all forecast steps, plus values at the final horizon step only.</li>
              <li><strong className="text-on-surface">Centralized baseline:</strong> same model, data and splits; per evaluation epoch it takes as many gradient steps as all sampled clients take in one round.</li>
              <li><strong className="text-on-surface">Runtime:</strong> training time = local training + aggregation; end-to-end runtime = job start (data loading) to final test evaluation.</li>
            </ul>
          </div>
        </div>

        <div className={card}>
          <h2 className="font-headline-md text-headline-md font-bold text-on-surface mb-space-sm">Communication accounting</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-space-sm font-body-sm text-body-sm text-on-surface-variant">
            <div className="bg-surface-container-low p-space-sm rounded-xl">
              <strong className="text-on-surface block">What is counted</strong>
              The exact length of each serialized message: a small JSON header plus tensor bytes. Each round counts one global-model download per sampled client and one update upload per client that did not drop out.
            </div>
            <div className="bg-surface-container-low p-space-sm rounded-xl">
              <strong className="text-on-surface block">What is not counted</strong>
              TCP/IP, TLS and HTTP overhead, retransmissions, and the few aggregate numbers clients report for evaluation. Transfer times are estimates (bytes × 8 ÷ configured bandwidth), not measurements.
            </div>
            <div className="bg-surface-container-low p-space-sm rounded-xl">
              <strong className="text-on-surface block">Encodings</strong>
              fp32 (4 B/value), fp16 (2 B), int8 (1 B with per-tensor min/scale), top-k (indices + fp32 values of the largest |Δ|, with error feedback). Centralized cost = float32 bytes of every training record, all features.
            </div>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-space-sm">The same rules apply to every experiment. Totals can be traced to per-client ledger rows (Communication page, or the ledger CSV export).</p>
        </div>

        <div className={card}>
          <div className="flex items-center justify-between mb-space-sm">
            <h2 className="font-headline-md text-headline-md font-bold text-on-surface">Datasets</h2>
            <span className="font-label-sm text-label-sm text-on-surface-variant">{backendOnline === false ? 'backend offline: dataset details unavailable' : 'reported by the backend'}</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-sm">
            {datasets.map((d) => (
              <div key={d.id} className={`p-space-sm rounded-xl border ${d.available ? 'bg-surface-container-low border-surface-container' : 'bg-surface-container-low/50 border-dashed border-surface-container-high opacity-80'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md font-bold text-on-surface">{d.name}</span>
                </div>
                <div className="flex gap-1 mt-1 flex-wrap">
                  <span className={`font-label-sm text-label-sm px-1.5 py-0.5 rounded font-bold ${d.available ? 'bg-on-tertiary-container/15 text-on-tertiary-container' : 'bg-surface-container text-on-surface-variant'}`}>{d.available ? 'available' : 'not installed'}</span>
                  {d.is_synthetic && <span className="font-label-sm text-label-sm px-1.5 py-0.5 rounded font-bold bg-amber-500/15 text-amber-800">synthetic</span>}
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{d.description}</p>
                <dl className="mt-1 font-label-sm text-label-sm text-on-surface-variant grid grid-cols-2 gap-x-2">
                  <dt>Features</dt>
                  <dd className="font-mono text-on-surface">{d.features.map((f) => `${f} (${d.units[f]})`).join(', ')}</dd>
                  <dt>Interval</dt>
                  <dd className="font-mono text-on-surface">{d.interval_minutes} min</dd>
                  {d.num_sensors && (
                    <>
                      <dt>Sensors × steps</dt>
                      <dd className="font-mono text-on-surface">{d.num_sensors} × {d.num_steps?.toLocaleString()}</dd>
                      <dt>Period</dt>
                      <dd className="font-mono text-on-surface">{d.start_time?.slice(0, 10)} → {d.end_time?.slice(0, 10)}</dd>
                    </>
                  )}
                  <dt>Source</dt>
                  <dd className="text-on-surface">{d.source}</dd>
                </dl>
                {!d.available && d.unavailable_reason && <p className="font-label-sm text-label-sm text-on-surface-variant mt-1 italic">{d.unavailable_reason}</p>}
              </div>
            ))}
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-space-sm">
            METR-LA contains speed only. Volume/occupancy are offered as targets only for datasets that contain them (PeMS04 has flow, occupancy and speed).
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-space-lg">
          <div className={card}>
            <h2 className="font-headline-md text-headline-md font-bold text-on-surface mb-space-sm">Limitations</h2>
            <ul className="space-y-2 font-body-sm text-body-sm text-on-surface-variant list-disc pl-5">
              <li>Clients are simulated sequentially in one process; no physical network is involved.</li>
              <li>The forecaster is per-sensor and does not model spatial dependencies between sensors (no graph). DCRNN/STGCN-style models are future work.</li>
              <li>Keeping data local is not a formal privacy guarantee. Model updates can leak information; secure aggregation and differential privacy are not implemented.</li>
              <li>Client groups are built from sensor index order, random shuffles, or Dirichlet splits of traffic levels, not from verified geography.</li>
              <li>Results depend on the chosen seed, sensors and training budget; compare runs only within the same protocol (the Experiments page flags mismatches).</li>
              <li>No accuracy or communication-saving figure is claimed in advance. Every figure in the dashboard comes from a stored experiment.</li>
            </ul>
          </div>
          <div className={card}>
            <h2 className="font-headline-md text-headline-md font-bold text-on-surface mb-space-sm">Reproduce</h2>
            <pre className="bg-surface-container p-space-sm rounded-xl font-mono text-label-sm text-on-surface overflow-x-auto">{runCmd}</pre>
            <button
              onClick={() => {
                navigator.clipboard.writeText(runCmd);
                setCopied(true);
                addToast('Copied', 'Run commands copied.', 'success');
                setTimeout(() => setCopied(false), 2000);
              }}
              className="mt-2 px-3 py-1.5 bg-surface-container rounded-xl font-label-sm text-label-sm font-bold cursor-pointer"
            >
              {copied ? 'Copied' : 'Copy commands'}
            </button>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-space-sm">
              Every experiment stores its full configuration, dataset SHA-256, seed and software versions. Use the JSON export on the{' '}
              <button onClick={() => setActiveTab('experiments')} className="text-secondary underline cursor-pointer">Experiments page</button> to re-create a run with identical settings.
            </p>
          </div>
        </div>

        <div className={card}>
          <h2 className="font-headline-md text-headline-md font-bold text-on-surface mb-space-sm">References</h2>
          <ol className="space-y-1.5 font-body-sm text-body-sm list-decimal pl-5">
            {REFERENCES.map((r) => (
              <li key={r.url}>
                <a href={r.url} target="_blank" rel="noreferrer" className="text-secondary hover:underline">
                  {r.title}
                </a>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
};
