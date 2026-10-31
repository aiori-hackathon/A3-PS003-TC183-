import React, { useState, useEffect, useRef } from 'react';
import { useApp, SearchResultItem } from '../context/AppContext';
import { PageId } from './Sidebar';

export const SearchModal: React.FC = () => {
  const {
    isSearchOpen,
    setIsSearchOpen,
    setActiveTab,
    stepRound,
    resetSimulator,
    togglePlaySimulator,
    setCurrentSeed,
    setCurrentAlpha,
    setIsProfileOpen,
    setIsNodeClusterModalOpen,
    addToast,
  } = useApp();

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    } else {
      setQuery('');
    }
  }, [isSearchOpen]);

  // Comprehensive index of searchable items
  const searchItems: SearchResultItem[] = [
    // Pages
    {
      id: 'page-overview',
      title: 'Problem & Overview',
      category: 'Page',
      description: 'System Overview, Research Matrix, Scope Boundaries & Architecture',
      pageId: 'problem-and-overview',
      keywords: ['problem', 'overview', 'traffic', 'smart cities', 'challenge', 'matrix', 'architecture', 'scope', 'guidelines'],
    },
    {
      id: 'page-simulator',
      title: 'Federated Simulator',
      category: 'Page',
      description: 'Live FedAvg parameter server, interactive rounds, terminal stream & 5-node topology',
      pageId: 'federated-simulator',
      keywords: ['simulator', 'federated', 'fedavg', 'round', 'play', 'step', 'stream', 'terminal', 'nodes', 'weights', 'consensus'],
    },
    {
      id: 'page-benchmark',
      title: 'Centralized vs FedAvg Benchmark',
      category: 'Page',
      description: 'Comparative performance matrix, test MAE/RMSE, cellular costs & convergence curves',
      pageId: 'centralized-vs-fedavg-benchmark',
      keywords: ['benchmark', 'centralized', 'comparison', 'mae', 'rmse', 'accuracy', 'baseline', 'cost', 'parity', 'seeds'],
    },
    {
      id: 'page-telemetry',
      title: 'Client Non-IID Telemetry',
      category: 'Page',
      description: 'Dirichlet(α) partition statistics, per-client daily profiles and heterogeneity',
      pageId: 'client-non-iid-telemetry',
      keywords: ['client', 'telemetry', 'non-iid', 'dirichlet', 'skew', 'heterogeneity', 'divergence', 'emd', 'heatmap', 'diurnal'],
    },
    {
      id: 'page-comm',
      title: 'Communication & Convergence',
      category: 'Page',
      description: 'Bandwidth transmission ledger, byte reduction audit, multi-seed error curves & LaTeX export',
      pageId: 'communication-and-convergence-analysis',
      keywords: ['communication', 'convergence', 'bandwidth', 'bytes', 'latex', 'ledger', 'mb', 'kb', 'savings', 'cellular'],
    },
    {
      id: 'page-experiments',
      title: 'Experiments & Compare',
      category: 'Page',
      description: 'Configure and run experiments, evaluation suites, history, comparison and CSV/JSON export',
      pageId: 'experiments',
      keywords: ['experiments', 'configure', 'suite', 'history', 'compare', 'export', 'csv', 'json', 'preset', 'baseline'],
    },
    {
      id: 'page-features',
      title: 'Methodology & Sources',
      category: 'Page',
      description: 'System features matrix, smart city advantages, METR-LA/PeMS datasets & BibTeX citation',
      pageId: 'features-benefits-and-sources',
      keywords: ['features', 'benefits', 'sources', 'citations', 'bibtex', 'metr-la', 'pems', 'gru', 'dataset', 'open-source'],
    },

    // Quick Actions
    {
      id: 'act-step',
      title: 'Execute FedAvg Step (+1 Round)',
      category: 'Action',
      description: 'Broadcast global model and compute FedAvg scalar reduction on current nodes',
      pageId: 'federated-simulator',
      action: () => stepRound(1),
      keywords: ['step', 'run', 'execute', 'round', 'next', 'iterate'],
    },
    {
      id: 'act-step-10',
      title: 'Advance +10 FedAvg Rounds',
      category: 'Action',
      description: 'Fast-forward simulation by 10 global communication cycles',
      pageId: 'federated-simulator',
      action: () => stepRound(10),
      keywords: ['fast forward', '+10', '10 rounds', 'jump'],
    },
    {
      id: 'act-play',
      title: 'Toggle Continuous Auto-Play Simulation',
      category: 'Action',
      description: 'Start, pause or resume the active backend experiment',
      pageId: 'federated-simulator',
      action: () => togglePlaySimulator(),
      keywords: ['play', 'pause', 'toggle', 'auto', 'stream', 'continuous'],
    },
    {
      id: 'act-reset',
      title: 'Reset Simulator State',
      category: 'Action',
      description: 'Cancel the active run and clear the simulator view',
      pageId: 'federated-simulator',
      action: () => resetSimulator(),
      keywords: ['reset', 'restart', 'clear', 'round 1', 'restore'],
    },
    {
      id: 'act-profile',
      title: 'Open Researcher Profile & Settings',
      category: 'Action',
      description: 'Edit personal info, credentials, API key, and customize platform theme colors',
      pageId: 'problem-and-overview',
      action: () => setIsProfileOpen(true),
      keywords: ['profile', 'user', 'settings', 'account', 'theme', 'color', 'token', 'credentials', 'researcher'],
    },
    {
      id: 'act-cluster',
      title: 'Open Edge Node Cluster Inspector',
      category: 'Action',
      description: 'Inspect the clients of the active experiment: sensors, weights, losses, uploads',
      pageId: 'federated-simulator',
      action: () => setIsNodeClusterModalOpen(true),
      keywords: ['cluster', 'edge nodes', 'nodes', 'intersections', 'hardware', '5 nodes', 'inspect'],
    },

    // Datasets & Models
    {
      id: 'data-metr-la',
      title: 'METR-LA Dataset Specification',
      category: 'Dataset',
      description: 'Los Angeles highway traffic speed (207 loop detectors). Speed only; optional, needs metr-la.h5',
      pageId: 'features-benefits-and-sources',
      keywords: ['metr-la', 'dataset', 'sensors', 'los angeles', 'highway', 'loop detectors', 'cc by 4.0'],
    },
    {
      id: 'data-pems',
      title: 'PeMS04 Dataset (default)',
      category: 'Dataset',
      description: 'Caltrans PeMS District 4: 307 sensors, flow/occupancy/speed, 5-min, Jan–Feb 2018',
      pageId: 'features-benefits-and-sources',
      keywords: ['pems', 'pems04', 'caltrans', 'dot', 'bay area', 'sensor network', 'flow'],
    },
    {
      id: 'sub-gru',
      title: 'Compact GRU Forecaster',
      category: 'Subsystem',
      description: '1-layer GRU + MLP head (~18k parameters, ~72 KB fp32), identical on every client',
      pageId: 'features-benefits-and-sources',
      keywords: ['gru', 'model', 'architecture', 'deep learning', 'recurrent', 'spatio-temporal', 'stgcn', 'weights'],
    },
    {
      id: 'sub-dirichlet',
      title: 'Dirichlet(α) Skew Parameter',
      category: 'Simulation',
      description: 'Controls Non-IID distribution imbalance: α=0.10 (Severe), α=0.50 (Moderate), α=∞ (IID)',
      pageId: 'client-non-iid-telemetry',
      action: () => {
        setActiveTab('client-non-iid-telemetry');
        addToast('Dirichlet Controls', 'Adjust the concentration slider to observe client drift impact.', 'info');
      },
      keywords: ['dirichlet', 'alpha', 'skew', 'heterogeneity', 'non-iid', 'distribution'],
    },
    {
      id: 'sub-seed-42',
      title: 'Switch RNG Seed: 42 (Nominal)',
      category: 'Action',
      description: 'Seed 42 deterministic initialization for multi-seed comparison protocol',
      pageId: 'federated-simulator',
      action: () => {
        setCurrentSeed(42);
        addToast('Seed Switched', 'Active PRNG seed set to 42.', 'info');
      },
      keywords: ['seed 42', 'seed', 'rng', 'random', 'reproducibility'],
    },
    {
      id: 'sub-seed-108',
      title: 'Switch RNG Seed: 108 (Secondary)',
      category: 'Action',
      description: 'Seed 108 trial for variance verification across stochastic batches',
      pageId: 'federated-simulator',
      action: () => {
        setCurrentSeed(108);
        addToast('Seed Switched', 'Active PRNG seed set to 108.', 'info');
      },
      keywords: ['seed 108', 'seed', 'rng', 'random', 'reproducibility'],
    },
    {
      id: 'sub-seed-999',
      title: 'Switch RNG Seed: 999 (High Dispersion)',
      category: 'Action',
      description: 'Seed 999 trial to test convergence under alternate weight initializations',
      pageId: 'federated-simulator',
      action: () => {
        setCurrentSeed(999);
        addToast('Seed Switched', 'Active PRNG seed set to 999.', 'info');
      },
      keywords: ['seed 999', 'seed', 'rng', 'random', 'reproducibility'],
    },
  ];

  // Filtering
  const filtered = searchItems.filter((item) => {
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    if (!matchesCategory) return false;
    if (!query.trim()) return true;

    const q = query.toLowerCase();
    const titleMatch = item.title.toLowerCase().includes(q);
    const descMatch = item.description.toLowerCase().includes(q);
    const kwMatch = item.keywords.some((kw) => kw.toLowerCase().includes(q));
    return titleMatch || descMatch || kwMatch;
  });

  const handleSelect = (item: SearchResultItem) => {
    setIsSearchOpen(false);
    if (item.action) {
      item.action();
    }
    setActiveTab(item.pageId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        handleSelect(filtered[selectedIndex]);
      }
    }
  };

  if (!isSearchOpen) return null;

  const categories = ['All', 'Page', 'Action', 'Simulation', 'Dataset', 'Subsystem'];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      {/* Backdrop click */}
      <div className="fixed inset-0 -z-10" onClick={() => setIsSearchOpen(false)} />

      <div className="w-full max-w-2xl bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container overflow-hidden flex flex-col max-h-[80vh] transition-all duration-200">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-surface-container gap-3 bg-surface-container-low/50">
          <span className="material-symbols-outlined text-[22px] text-secondary">search</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, metrics, actions, datasets (e.g., 'FedAvg', 'Dirichlet', 'LaTeX')..."
            className="w-full bg-transparent text-on-surface font-body-md text-body-lg placeholder:text-on-surface-variant outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
          <span className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-surface-container text-on-surface-variant hidden sm:inline">
            ESC to close
          </span>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-surface-container overflow-x-auto bg-surface-container-lowest text-xs">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                setSelectedIndex(0);
              }}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
                selectedCategory === cat
                  ? 'bg-secondary text-on-secondary font-semibold'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-2 space-y-1 flex-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[36px] mb-2 opacity-50">search_off</span>
              <p className="font-headline-sm text-headline-sm font-semibold text-on-surface">No results found</p>
              <p className="font-body-sm text-body-sm mt-1">Try searching for keywords like "FedAvg", "Dirichlet", "MAE", "PeMS", or "Profile".</p>
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const categoryBadge = {
                Page: 'bg-primary/10 text-primary',
                Action: 'bg-on-tertiary-container/15 text-on-tertiary-container',
                Simulation: 'bg-secondary/15 text-secondary',
                Dataset: 'bg-amber-500/15 text-amber-700',
                Subsystem: 'bg-purple-500/15 text-purple-700',
                Metric: 'bg-blue-500/15 text-blue-700',
              }[item.category];

              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`p-3 rounded-xl cursor-pointer flex items-center justify-between gap-3 transition-colors ${
                    isSelected
                      ? 'bg-surface-container text-on-surface shadow-xs'
                      : 'hover:bg-surface-container-low text-on-surface'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-[20px] text-secondary mt-0.5">
                      {item.category === 'Page'
                        ? 'web'
                        : item.category === 'Action'
                        ? 'bolt'
                        : item.category === 'Dataset'
                        ? 'database'
                        : 'hub'}
                    </span>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-headline-sm text-body-md font-bold text-on-surface">
                          {item.title}
                        </span>
                        <span className={`font-label-sm text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${categoryBadge}`}>
                          {item.category}
                        </span>
                      </div>
                      <span className="font-body-sm text-body-sm text-on-surface-variant line-clamp-1 mt-0.5">
                        {item.description}
                      </span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[16px] text-on-surface-variant opacity-60">
                    arrow_forward
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 bg-surface-container-low/70 border-t border-surface-container flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-surface-container-high rounded text-[11px] font-mono">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-surface-container-high rounded text-[11px] font-mono">↓</kbd>
              <span>to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-surface-container-high rounded text-[11px] font-mono">↵</kbd>
              <span>to select</span>
            </span>
          </div>
          <span>{filtered.length} items</span>
        </div>
      </div>
    </div>
  );
};

