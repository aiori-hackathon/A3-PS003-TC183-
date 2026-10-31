import React, { useState } from 'react';
import { PageId } from '../components/Sidebar';
import { useApp } from '../context/AppContext';

interface ProblemOverviewProps {
  onNavigate: (tab: PageId) => void;
}

export const ProblemOverview: React.FC<ProblemOverviewProps> = ({ onNavigate }) => {
  const {
    currentRound,
    currentClients,
    networkTransferredMB,
    globalMAE,
    globalRMSE,
    maxRounds,
    maeKind,
    metricUnit,
    activeExperiment,
    experiments,
    stepRound,
    setIsNodeClusterModalOpen,
    setIsSearchOpen,
    addToast,
  } = useApp();

  const [activeDiagramNode, setActiveDiagramNode] = useState<string | null>(null);
  const [checklistFilter, setChecklistFilter] = useState<'all' | 'mandatory' | 'scope'>('all');
  const [checkedItems, setCheckedItems] = useState<{ [key: number]: boolean }>({
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
    6: true,
    7: true,
  });

  const toggleCheck = (idx: number) => {
    setCheckedItems((prev) => {
      const next = !prev[idx];
      addToast(
        `Requirement #${idx} ${next ? 'Verified' : 'Flagged for Review'}`,
        next ? 'Requirement verified.' : 'Status updated to pending evaluation.',
        next ? 'success' : 'info'
      );
      return { ...prev, [idx]: next };
    });
  };

  const handleTestSimulation = () => {
    stepRound(1);
    addToast('Simulation Step Triggered', 'Synchronized weights across edge cluster.', 'success');
  };

  return (
    <div className="flex flex-col w-full animate-fade-in">
      <div className="px-space-md lg:px-space-margin-desktop py-space-xl flex flex-col gap-space-xl max-w-7xl mx-auto w-full">
        {/* Document Header / Official Research Identity */}
        <div className="bg-surface-container-lowest p-space-lg md:p-space-xl rounded-2xl shadow-sm border border-surface-container/70 flex flex-col md:flex-row justify-between items-start md:items-center gap-space-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-secondary/5 via-primary/5 to-transparent rounded-full blur-3xl -z-10 pointer-events-none"></div>

          <div className="flex flex-col gap-space-xs">
            <div className="flex flex-wrap items-center gap-space-xs">
              <span className="bg-surface-container-high text-secondary font-label-md text-label-md px-space-sm py-0.5 rounded-lg uppercase font-semibold tracking-wider flex items-center gap-1.5 shadow-2xs">
                <span className="material-symbols-outlined text-[15px]">location_city</span>
                Category: Smart Cities
              </span>
              <span className="bg-primary text-on-primary font-label-md text-label-md px-space-sm py-0.5 rounded-lg font-mono font-bold">
                FL-TRAFFIC
              </span>
              <span className="bg-on-tertiary-container/15 text-on-tertiary-container font-label-sm text-label-sm px-space-sm py-0.5 rounded-lg flex items-center gap-1.5 font-semibold">
                <span className="w-2 h-2 rounded-full bg-on-tertiary-container animate-ping"></span>
                SMART CITIES RESEARCH TRACK
              </span>
            </div>
            <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight mt-1 font-bold">
              Federated Traffic-Flow Prediction with Communication-Cost Evaluation
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl leading-relaxed">
              National Smart Cities Edge Intelligence Initiative • Distributed Deep Learning Protocol for Bandwidth-Constrained Roadside Infrastructure.
            </p>
          </div>

          <div className="flex md:flex-col items-center md:items-end gap-space-sm shrink-0 self-stretch md:self-auto justify-between border-t md:border-t-0 pt-space-sm md:pt-0">
            <div className="flex items-center gap-space-xs bg-surface-container-low px-3 py-1.5 rounded-xl border border-surface-container">
              <div className="w-9 h-9 rounded-lg bg-secondary text-on-secondary flex items-center justify-center font-bold font-label-md shadow-xs">
                FL
              </div>
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm font-bold text-on-surface">Stage III System</span>
                <span className="font-label-sm text-label-sm text-on-tertiary-container font-semibold">Status: Prototype</span>
              </div>
            </div>
            <span className="font-label-sm text-label-sm text-secondary bg-secondary/10 px-space-sm py-1 rounded-lg font-mono font-bold">
              REF: FT-2024-SYS
            </span>
          </div>
        </div>

        {/* Live Telemetry Quick Cards (Dynamic state connected) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
          {/* Card 1: Simulated Cluster */}
          <div
            onClick={() => setIsNodeClusterModalOpen(true)}
            className="bg-surface-container-lowest p-space-md rounded-2xl shadow-sm border border-surface-container/70 hover:border-secondary/50 flex flex-col justify-between cursor-pointer hover:shadow-md transition-all duration-200 group active:scale-98"
          >
            <div className="flex justify-between items-center text-on-surface-variant mb-space-xs">
              <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold group-hover:text-secondary transition-colors">
                Simulated Cluster
              </span>
              <span className="material-symbols-outlined text-[20px] text-secondary group-hover:scale-110 transition-transform">
                hub
              </span>
            </div>
            <div className="flex items-baseline gap-space-xs">
              <span className="font-headline-lg text-headline-lg font-bold text-on-surface">
                {currentClients} Nodes
              </span>
              <span className="font-label-sm text-label-sm text-on-tertiary-container font-semibold">
                Virtual Edge RSU
              </span>
            </div>
            <div className="mt-space-sm pt-space-xs bg-surface-container-low p-space-xs rounded-xl flex justify-between items-center font-label-sm text-label-sm">
              <span className="text-on-surface-variant">{activeExperiment ? `${activeExperiment.config.dataset_id.toUpperCase()} • ${activeExperiment.config.partition}` : 'No run yet'}</span>
              <span className="text-secondary font-bold group-hover:underline">Inspect Mesh →</span>
            </div>
          </div>

          {/* Card 2: Global FedAvg Round */}
          <div
            onClick={() => onNavigate('federated-simulator')}
            className="bg-surface-container-lowest p-space-md rounded-2xl shadow-sm border border-surface-container/70 hover:border-secondary/50 flex flex-col justify-between cursor-pointer hover:shadow-md transition-all duration-200 group active:scale-98"
          >
            <div className="flex justify-between items-center text-on-surface-variant mb-space-xs">
              <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold group-hover:text-secondary transition-colors">
                Communication Round
              </span>
              <span className="material-symbols-outlined text-[20px] text-on-tertiary-container group-hover:rotate-180 transition-transform duration-500">
                sync
              </span>
            </div>
            <div className="flex items-baseline gap-space-xs">
              <span className="font-headline-lg text-headline-lg font-bold text-on-surface">
                Round #{currentRound}
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">/ {maxRounds}</span>
            </div>
            <div className="mt-space-sm w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-secondary h-full rounded-full transition-all duration-300"
                style={{ width: `${maxRounds ? Math.min(100, (currentRound / maxRounds) * 100) : 0}%` }}
              ></div>
            </div>
          </div>

          {/* Card 3: Tx Data Transferred */}
          <div
            onClick={() => onNavigate('communication-and-convergence-analysis')}
            className="bg-surface-container-lowest p-space-md rounded-2xl shadow-sm border border-surface-container/70 hover:border-secondary/50 flex flex-col justify-between cursor-pointer hover:shadow-md transition-all duration-200 group active:scale-98"
          >
            <div className="flex justify-between items-center text-on-surface-variant mb-space-xs">
              <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold group-hover:text-secondary transition-colors">
                Measured Communication
              </span>
              <span className="material-symbols-outlined text-[20px] text-secondary group-hover:scale-110 transition-transform">
                swap_vert
              </span>
            </div>
            <div className="flex items-baseline gap-space-xs">
              <span className="font-headline-lg text-headline-lg font-bold text-on-surface">
                {networkTransferredMB === null ? '—' : `${networkTransferredMB.toFixed(2)} MB`}
              </span>
              <span className="font-label-sm text-label-sm text-on-tertiary-container font-semibold">
                serialized payloads
              </span>
            </div>
            <div className="mt-space-sm pt-space-xs bg-surface-container-low p-space-xs rounded-xl flex justify-between items-center font-label-sm text-label-sm">
              <span className="text-on-surface-variant">Payload: model updates only</span>
              <span className="text-secondary font-mono font-bold">{experiments.filter((e) => e.status === 'completed').length} completed runs</span>
            </div>
          </div>

          {/* Card 4: Global Validation MAE */}
          <div
            onClick={() => onNavigate('centralized-vs-fedavg-benchmark')}
            className="bg-surface-container-lowest p-space-md rounded-2xl shadow-sm border border-surface-container/70 hover:border-secondary/50 flex flex-col justify-between cursor-pointer hover:shadow-md transition-all duration-200 group active:scale-98"
          >
            <div className="flex justify-between items-center text-on-surface-variant mb-space-xs">
              <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold group-hover:text-secondary transition-colors">
                {maeKind === 'test' ? 'Test MAE (final)' : 'Validation MAE'}
              </span>
              <span className="material-symbols-outlined text-[20px] text-on-tertiary-container group-hover:scale-110 transition-transform">
                query_stats
              </span>
            </div>
            <div className="flex items-baseline gap-space-xs">
              <span className="font-headline-lg text-headline-lg font-bold text-on-surface">
                {globalMAE}
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                {metricUnit} (RMSE {globalRMSE})
              </span>
            </div>
            <div className="mt-space-sm pt-space-xs bg-surface-container-low p-space-xs rounded-xl flex justify-between items-center font-label-sm text-label-sm">
              <span className="text-on-surface-variant">{activeExperiment ? activeExperiment.name.slice(0, 32) : 'No experiment yet'}</span>
              <span className="text-on-tertiary-container font-bold">{activeExperiment ? activeExperiment.status : 'ready'}</span>
            </div>
          </div>
        </div>

        {/* Main Problem Statement & Technical Anatomy */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
          {/* Left Column: Verbatim Description & Paradigm Shift */}
          <div className="lg:col-span-8 flex flex-col gap-space-lg">
            {/* Official Description Card */}
            <div className="bg-surface-container-lowest p-space-lg md:p-space-xl rounded-2xl shadow-sm border border-surface-container/70 flex flex-col gap-space-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-secondary text-[22px]">description</span>
                  <h2 className="font-headline-md text-headline-md text-on-surface font-bold">Problem Description</h2>
                </div>
                <button
                  onClick={handleTestSimulation}
                  className="px-3 py-1 bg-secondary text-on-secondary rounded-lg font-label-sm text-label-sm font-semibold flex items-center gap-1 shadow-xs hover:bg-secondary/90 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">play_arrow</span>
                  <span>Run Step (+1)</span>
                </button>
              </div>

              <div className="p-space-md bg-surface-container-low rounded-xl text-on-surface font-body-md text-body-md leading-relaxed border border-surface-container">
                <p className="mb-space-sm">
                  <strong className="font-semibold text-primary">Centralized traffic forecasting</strong> requires edge cameras and roadside sensors to continuously stream raw telemetry and video vectors to a central cloud, consuming vast cellular bandwidth and concentrating private travel logs in a singular point of failure.
                </p>
                <p>
                  <strong className="font-semibold text-secondary">Federated Learning (FL)</strong> addresses this vulnerability by orchestrating on-device training across local edge intersection nodes and transmitting only mathematical parameter weight updates (<code className="font-mono text-label-sm bg-surface-container px-1.5 py-0.5 rounded font-bold text-secondary">Δw</code>) to an aggregation server. In this research problem, participants construct a federated simulator over a partitioned real-world traffic repository, comparing a compact GRU forecaster running FedAvg against centralized baselines across Non-IID skew conditions while rigorously tracking transmitted network byte footprints.
                </p>
              </div>

              {/* Paradigm Comparison: Centralized vs Federated */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md mt-space-xs">
                {/* Centralized Inefficiencies */}
                <div className="bg-surface-container-lowest p-space-md rounded-xl flex flex-col gap-space-xs border border-error/30 hover:border-error transition-colors shadow-2xs">
                  <div className="flex items-center gap-space-xs text-error font-headline-sm text-headline-sm font-bold">
                    <span className="material-symbols-outlined text-[20px]">cloud_sync</span>
                    <span>Centralized Paradigm</span>
                  </div>
                  <ul className="flex flex-col gap-space-xs font-body-sm text-body-sm text-on-surface-variant mt-space-xs list-disc list-inside">
                    <li><span className="text-on-surface font-semibold">Raw Streaming:</span> Every raw sensor record is shipped to a central server (measured per run on the Communication page).</li>
                    <li><span className="text-on-surface font-semibold">Privacy Exposure:</span> High-resolution license plate trajectories and vehicle spatio-temporal logs stored centrally.</li>
                    <li><span className="text-on-surface font-semibold">Bandwidth Tax:</span> Massive ongoing 4G/5G cellular overhead prone to link congestion and latency spikes.</li>
                  </ul>
                </div>

                {/* Federated Optimization */}
                <div className="bg-surface-container-lowest p-space-md rounded-xl flex flex-col gap-space-xs border border-on-tertiary-container/30 hover:border-on-tertiary-container transition-colors shadow-2xs">
                  <div className="flex items-center gap-space-xs text-on-tertiary-container font-headline-sm text-headline-sm font-bold">
                    <span className="material-symbols-outlined text-[20px]">share</span>
                    <span>Federated Paradigm (FedAvg)</span>
                  </div>
                  <ul className="flex flex-col gap-space-xs font-body-sm text-body-sm text-on-surface-variant mt-space-xs list-disc list-inside">
                    <li><span className="text-on-surface font-semibold">Edge Compute:</span> Local training on roadside processing units (RSUs) or intersection edge controllers.</li>
                    <li><span className="text-on-surface font-semibold">Data Locality:</span> Raw sensor time series stay on the client (not a formal privacy guarantee: no secure aggregation or differential privacy).</li>
                    <li><span className="text-on-surface font-semibold">Quantized Payloads:</span> Only model updates are transmitted each round, optionally compressed (fp16, int8, top-k).</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* The Core Challenge & Objectives Matrix */}
            <div className="bg-surface-container-lowest p-space-lg md:p-space-xl rounded-2xl shadow-sm border border-surface-container/70 flex flex-col gap-space-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-secondary text-[22px]">target</span>
                  <h2 className="font-headline-md text-headline-md text-on-surface font-bold">Research Challenge &amp; Objectives Matrix</h2>
                </div>
                <span className="font-label-sm text-label-sm text-secondary bg-secondary/10 px-space-sm py-1 rounded-lg font-mono font-bold">
                  Evaluation Framework
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left font-body-md text-body-md border-collapse">
                  <thead>
                    <tr className="bg-surface-container font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      <th className="py-space-sm px-space-md rounded-l-lg font-bold">Investigation Axis</th>
                      <th className="py-space-sm px-space-md font-bold">Central Research Question</th>
                      <th className="py-space-sm px-space-md font-bold">Quantitative Target</th>
                      <th className="py-space-sm px-space-md rounded-r-lg text-right font-bold">Impact Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container font-body-sm text-body-sm text-on-surface">
                    <tr className="hover:bg-surface-container-low transition-colors cursor-pointer" onClick={() => onNavigate('centralized-vs-fedavg-benchmark')}>
                      <td className="py-space-sm px-space-md font-bold text-primary flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-secondary">trending_up</span>
                        FedAvg Accuracy Parity
                      </td>
                      <td className="py-space-sm px-space-md text-on-surface-variant">How close does FedAvg get to the MAE of centralized training on the same data?</td>
                      <td className="py-space-sm px-space-md font-mono text-secondary font-bold">Reported as % MAE gap</td>
                      <td className="py-space-sm px-space-md text-right font-label-md text-label-md font-bold text-on-tertiary-container">HIGH</td>
                    </tr>
                    <tr className="hover:bg-surface-container-low transition-colors cursor-pointer" onClick={() => onNavigate('client-non-iid-telemetry')}>
                      <td className="py-space-sm px-space-md font-bold text-primary flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-error">pie_chart</span>
                        Non-IID Distribution Skew
                      </td>
                      <td className="py-space-sm px-space-md text-on-surface-variant">Quantify client drift when sensors display disparate morning/evening peak flow ratios.</td>
                      <td className="py-space-sm px-space-md font-mono text-secondary font-bold">Dirichlet α ∈ [0.1, 1.0]</td>
                      <td className="py-space-sm px-space-md text-right font-label-md text-label-md font-bold text-on-tertiary-container">CRITICAL</td>
                    </tr>
                    <tr className="hover:bg-surface-container-low transition-colors cursor-pointer" onClick={() => onNavigate('communication-and-convergence-analysis')}>
                      <td className="py-space-sm px-space-md font-bold text-primary flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-on-tertiary-container">speed</span>
                        Communication Payload Cost
                      </td>
                      <td className="py-space-sm px-space-md text-on-surface-variant">Measure exact byte reduction across upstream &amp; downstream weight sync cycles.</td>
                      <td className="py-space-sm px-space-md font-mono text-secondary font-bold">Bytes per run, from the ledger</td>
                      <td className="py-space-sm px-space-md text-right font-label-md text-label-md font-bold text-secondary">HIGH</td>
                    </tr>
                    <tr className="hover:bg-surface-container-low transition-colors cursor-pointer" onClick={() => onNavigate('centralized-vs-fedavg-benchmark')}>
                      <td className="py-space-sm px-space-md font-bold text-primary flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-primary">science</span>
                        Multi-Seed Reproducibility
                      </td>
                      <td className="py-space-sm px-space-md text-on-surface-variant">Demonstrate consistent convergence curves and stability across non-deterministic seeds.</td>
                      <td className="py-space-sm px-space-md font-mono text-secondary font-bold">Seeds: 42, 108, 999</td>
                      <td className="py-space-sm px-space-md text-right font-label-md text-label-md font-bold text-on-surface-variant">STANDARD</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Interactive Simulation Pipeline Architecture Diagram */}
            <div className="bg-surface-container-lowest p-space-lg md:p-space-xl rounded-2xl shadow-sm border border-surface-container/70 flex flex-col gap-space-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-secondary text-[22px]">account_tree</span>
                  <h2 className="font-headline-md text-headline-md text-on-surface font-bold">End-to-End Simulation Architecture</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveDiagramNode(activeDiagramNode ? null : 'edge')}
                    className="font-label-sm text-label-sm text-secondary bg-surface-container px-space-sm py-1 rounded-lg font-mono hover:bg-surface-container-high transition-colors cursor-pointer"
                  >
                    {activeDiagramNode ? 'Hide Details' : 'Interactive Details'}
                  </button>
                  <span className="font-label-sm text-label-sm text-on-tertiary-container bg-surface-container px-space-sm py-1 rounded-lg font-mono">
                    Chronological Strict Split
                  </span>
                </div>
              </div>

              {/* Interactive SVG Diagram */}
              <div className="w-full bg-surface-container-low p-space-md rounded-xl overflow-x-auto border border-surface-container">
                <svg className="w-full min-w-[640px] h-48 text-on-surface select-none" fill="none" viewBox="0 0 760 190" xmlns="http://www.w3.org/2000/svg">
                  {/* Edge Clients Box */}
                  <g
                    className="cursor-pointer transition-transform duration-200 hover:opacity-90"
                    onClick={() => setIsNodeClusterModalOpen(true)}
                  >
                    <rect fill="#FFFFFF" height="150" rx="10" stroke="#c6c6cd" strokeWidth="1" width="180" x="20" y="20"></rect>
                    <text className="text-xs font-semibold" fill="#006398" fontFamily="JetBrains Mono" x="35" y="45">EDGE CLIENT NODES (5)</text>
                    <rect fill="#E5EEFF" height="24" rx="6" width="150" x="35" y="60"></rect>
                    <text fill="#0B1C30" fontFamily="Inter" fontSize="11" fontWeight="600" x="45" y="76">Node A: Arterial Road</text>
                    <rect fill="#E5EEFF" height="24" rx="6" width="150" x="35" y="92"></rect>
                    <text fill="#0B1C30" fontFamily="Inter" fontSize="11" fontWeight="600" x="45" y="108">Node B: Highway Onramp</text>
                    <rect fill="#E5EEFF" height="24" rx="6" width="150" x="35" y="124"></rect>
                    <text fill="#0B1C30" fontFamily="Inter" fontSize="11" fontWeight="600" x="45" y="140">Node C-E: Urban Grid</text>
                  </g>

                  {/* Arrow: Local Training to Weight Transmission */}
                  <path d="M 200 95 L 260 95" stroke="#006398" strokeDasharray="4 4" strokeWidth="2.5"></path>
                  <polygon fill="#006398" points="260,95 250,89 250,101"></polygon>
                  <text fill="#006398" fontFamily="JetBrains Mono" fontSize="10" fontWeight="bold" x="210" y="85">Tx Δw</text>

                  {/* Central FedAvg Server */}
                  <g
                    className="cursor-pointer transition-transform duration-200 hover:opacity-90"
                    onClick={() => onNavigate('federated-simulator')}
                  >
                    <rect fill="#131B2E" height="150" rx="10" width="190" x="270" y="20"></rect>
                    <text className="text-xs font-semibold" fill="#5BB8FE" fontFamily="JetBrains Mono" x="285" y="45">CENTRAL AGGREGATOR</text>
                    <text fill="#E5EEFF" fontFamily="Inter" fontSize="12" fontWeight="700" x="285" y="70">FedAvg Protocol</text>
                    <text fill="#BEC6E0" fontFamily="JetBrains Mono" fontSize="10" x="285" y="90">w_t+1 = ∑ (n_k/n) w_t+1^k</text>
                    <rect fill="#213145" height="38" rx="6" width="160" x="285" y="110"></rect>
                    <text fill="#4EDEA3" fontFamily="JetBrains Mono" fontSize="10" fontWeight="bold" x="295" y="126">Byte Counter: Active</text>
                    <text fill="#BEC6E0" fontFamily="JetBrains Mono" fontSize="10" x="295" y="140">Loss Tracker: Active</text>
                  </g>

                  {/* Arrow: Aggregation to Global Broadcast */}
                  <path d="M 460 95 L 520 95" stroke="#009668" strokeWidth="2.5"></path>
                  <polygon fill="#009668" points="520,95 510,89 510,101"></polygon>
                  <text fill="#009668" fontFamily="JetBrains Mono" fontSize="10" fontWeight="bold" x="468" y="85">Rx w_t+1</text>

                  {/* Evaluation & Reporting */}
                  <g
                    className="cursor-pointer transition-transform duration-200 hover:opacity-90"
                    onClick={() => onNavigate('centralized-vs-fedavg-benchmark')}
                  >
                    <rect fill="#FFFFFF" height="150" rx="10" stroke="#c6c6cd" strokeWidth="1" width="200" x="530" y="20"></rect>
                    <text className="text-xs font-semibold" fill="#006398" fontFamily="JetBrains Mono" x="545" y="45">BENCHMARK EVALUATION</text>
                    <rect fill="#EFF4FF" height="26" rx="6" width="170" x="545" y="60"></rect>
                    <text fill="#0B1C30" fontFamily="Inter" fontSize="11" fontWeight="600" x="555" y="77">MAE / RMSE Calculation</text>
                    <rect fill="#EFF4FF" height="26" rx="6" width="170" x="545" y="94"></rect>
                    <text fill="#0B1C30" fontFamily="Inter" fontSize="11" fontWeight="600" x="555" y="111">Total Kilobytes vs Steps</text>
                    <rect fill="#EFF4FF" height="26" rx="6" width="170" x="545" y="128"></rect>
                    <text fill="#0B1C30" fontFamily="Inter" fontSize="11" fontWeight="600" x="555" y="145">Seed Stability Variance</text>
                  </g>
                </svg>
              </div>

              {activeDiagramNode && (
                <div className="p-space-md bg-surface-container rounded-xl text-body-sm text-on-surface animate-fade-in flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary">info</span>
                    <span><strong>Interactive Map:</strong> Click on "Edge Client Nodes" to open the Mesh Inspector, or "Central Aggregator" to enter the Federated Simulator.</span>
                  </div>
                  <button
                    onClick={() => onNavigate('federated-simulator')}
                    className="px-3 py-1 bg-secondary text-on-secondary rounded-lg font-semibold font-label-sm text-label-sm"
                  >
                    Open Simulator
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between text-on-surface-variant font-body-sm text-body-sm">
                <span>Note: Local raw sensor vectors never traverse external networks.</span>
                <span className="font-mono text-label-sm font-semibold text-secondary">FedAvg (McMahan et al.)</span>
              </div>
            </div>
          </div>

          {/* Right Column: Key Requirements Checklist & Out-of-Scope Guardrails */}
          <div className="lg:col-span-4 flex flex-col gap-space-lg">
            {/* Requirements Checklist Card */}
            <div className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-sm border border-surface-container/70 flex flex-col gap-space-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-secondary text-[22px]">fact_check</span>
                  <h2 className="font-headline-md text-headline-md text-on-surface font-bold">Key Requirements</h2>
                </div>
                <span className="font-label-sm text-label-sm bg-on-tertiary-container/15 text-on-tertiary-container px-space-xs py-0.5 rounded-lg font-bold font-mono">
                  {Object.values(checkedItems).filter(Boolean).length} of 7 Met
                </span>
              </div>

              <div className="flex flex-col gap-space-sm font-body-sm text-body-sm">
                {[
                  {
                    id: 1,
                    title: '1 Public Traffic Dataset',
                    desc: 'METR-LA / PeMS split across 3–5 simulated client intersections.',
                    page: 'features-benefits-and-sources' as PageId,
                  },
                  {
                    id: 2,
                    title: 'Compact Forecasting Model',
                    desc: 'FedAvg orchestration implemented over a compact GRU forecaster.',
                    page: 'federated-simulator' as PageId,
                  },
                  {
                    id: 3,
                    title: 'Chronological Train/Test Split',
                    desc: 'Strict forward temporal split preventing future-state leakage.',
                    page: 'client-non-iid-telemetry' as PageId,
                  },
                  {
                    id: 4,
                    title: 'IID vs Non-IID Partition Evaluation',
                    desc: 'Dirichlet distribution and volume-skewed node allocations benchmarked.',
                    page: 'client-non-iid-telemetry' as PageId,
                  },
                  {
                    id: 5,
                    title: 'Metrics: MAE, RMSE & Transmitted Bytes',
                    desc: 'Continuous telemetry tracking byte transmission vs convergence steps.',
                    page: 'centralized-vs-fedavg-benchmark' as PageId,
                  },
                  {
                    id: 6,
                    title: 'Multi-Seed Reproducibility (3 Seeds)',
                    desc: 'Execution across deterministic seeds: 42, 108, 999 with error bands.',
                    page: 'communication-and-convergence-analysis' as PageId,
                  },
                  {
                    id: 7,
                    title: 'Communication Overhead Reduction',
                    desc: 'Evaluated parameter compression exceeding 80% bandwidth economy.',
                    page: 'communication-and-convergence-analysis' as PageId,
                  },
                ].map((req) => {
                  const isDone = checkedItems[req.id];
                  return (
                    <div
                      key={req.id}
                      className="p-space-sm bg-surface-container-low hover:bg-surface-container rounded-xl flex items-start gap-space-sm transition-colors cursor-pointer group"
                      onClick={() => toggleCheck(req.id)}
                    >
                      <button
                        className="mt-0.5 shrink-0"
                        title={isDone ? 'Mark as incomplete' : 'Mark as complete'}
                      >
                        <span
                          className={`material-symbols-outlined text-[20px] transition-colors ${
                            isDone ? 'text-on-tertiary-container' : 'text-outline-variant'
                          }`}
                        >
                          {isDone ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                      </button>
                      <div className="flex flex-col flex-1">
                        <div className="flex items-center justify-between">
                          <span className={`font-bold text-on-surface ${isDone ? '' : 'line-through opacity-60'}`}>
                            {req.title}
                          </span>
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigate(req.page);
                            }}
                            className="text-[11px] text-secondary font-semibold hover:underline"
                          >
                            View →
                          </span>
                        </div>
                        <span className="text-on-surface-variant text-xs mt-0.5">{req.desc}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Strict Scope Boundaries / Negative Constraints */}
            <div className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-sm border-l-4 border-error border-surface-container/70 flex flex-col gap-space-md">
              <div className="flex items-center gap-space-xs text-error font-bold">
                <span className="material-symbols-outlined text-[22px]">block</span>
                <h2 className="font-headline-sm text-headline-sm">Strict Scope Boundaries</h2>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                Per the research committee directives, projects will not be evaluated on hardware edge deployments or cryptographically guaranteed privacy schemes:
              </p>
              <div className="flex flex-col gap-space-xs font-body-sm text-body-sm">
                <div className="flex items-center gap-space-xs text-on-surface bg-surface-container-low p-2 rounded-lg">
                  <span className="material-symbols-outlined text-error text-[18px]">close</span>
                  <span><strong>No live edge cameras:</strong> Use offline public datasets.</span>
                </div>
                <div className="flex items-center gap-space-xs text-on-surface bg-surface-container-low p-2 rounded-lg">
                  <span className="material-symbols-outlined text-error text-[18px]">close</span>
                  <span><strong>No city-wide physical deployment:</strong> Software simulation only.</span>
                </div>
                <div className="flex items-center gap-space-xs text-on-surface bg-surface-container-low p-2 rounded-lg">
                  <span className="material-symbols-outlined text-error text-[18px]">close</span>
                  <span><strong>No formal DP guarantees:</strong> Focus on FedAvg &amp; bandwidth.</span>
                </div>
              </div>
            </div>

            {/* Expected Deliverables Checklist */}
            <div className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-sm border border-surface-container/70 flex flex-col gap-space-md">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-secondary text-[22px]">inventory_2</span>
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">Expected Deliverables</h2>
              </div>
              <ul className="flex flex-col gap-space-xs font-body-sm text-body-sm text-on-surface-variant list-disc list-inside">
                <li>Federated Learning Simulation Pipeline (PeMS / METR-LA)</li>
                <li>Centralized vs Federated Benchmark Code &amp; MAE Parity</li>
                <li>Compact GRU forecaster (about 18k parameters, ~72 KB fp32)</li>
                <li>IID vs Non-IID Dirichlet Skew Experimental Evaluation</li>
                <li>Communication-Cost &amp; Convergence Analytics Ledger</li>
                <li>Comprehensive Final Report (Multi-Seed Synthesis)</li>
              </ul>
              <div className="pt-space-xs border-t border-surface-container">
                <div className="bg-surface-container-low p-space-sm rounded-xl font-label-sm text-label-sm text-on-surface flex items-center justify-between">
                  <span>System Architecture:</span>
                  <span className="text-secondary font-bold flex items-center gap-1">
                    Decentralized FedAvg
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Official Notice Footer */}
        <div className="bg-surface-container p-space-md rounded-xl flex flex-col sm:flex-row items-center justify-between gap-space-sm text-on-surface-variant font-label-sm text-label-sm">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-[18px] text-on-tertiary-container">verified_user</span>
            <span>All deliverables verified for Smart Cities Track. Participation certificate eligible.</span>
          </div>
          <div className="flex items-center gap-space-md">
            <span>Evaluator Build: v2.4.1</span>
            <span>Active Seed: <strong>Seed {useApp().currentSeed}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};
