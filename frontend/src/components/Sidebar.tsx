import React from 'react';
import { useApp } from '../context/AppContext';

export type PageId =
  | 'problem-and-overview'
  | 'federated-simulator'
  | 'centralized-vs-fedavg-benchmark'
  | 'client-non-iid-telemetry'
  | 'communication-and-convergence-analysis'
  | 'experiments'
  | 'features-benefits-and-sources';

export const PAGE_IDS: PageId[] = [
  'problem-and-overview',
  'federated-simulator',
  'centralized-vs-fedavg-benchmark',
  'client-non-iid-telemetry',
  'communication-and-convergence-analysis',
  'experiments',
  'features-benefits-and-sources',
];

interface SidebarProps {
  activeTab: PageId;
  onSelectTab: (tab: PageId) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const {
    currentRound,
    currentClients,
    networkTransferredMB,
    globalMAE,
    maxRounds,
    backendOnline,
    activeExperiment,
    metricUnit,
    experiments,
    setIsNodeClusterModalOpen,
    setIsSearchOpen,
    setIsProfileOpen,
    userProfile,
  } = useApp();

  const navItems: { id: PageId; label: string; icon: string; badge?: string }[] = [
    {
      id: 'problem-and-overview',
      label: 'Problem & Overview',
      icon: 'assignment',
    },
    {
      id: 'federated-simulator',
      label: 'Federated Simulator',
      icon: 'memory',
      badge: activeExperiment && ['queued', 'running'].includes(activeExperiment.status) ? 'LIVE' : undefined,
    },
    {
      id: 'centralized-vs-fedavg-benchmark',
      label: 'Centralized vs FedAvg',
      icon: 'compare_arrows',
    },
    {
      id: 'client-non-iid-telemetry',
      label: 'Client Non-IID Telemetry',
      icon: 'hub',
    },
    {
      id: 'communication-and-convergence-analysis',
      label: 'Communication & Cost',
      icon: 'query_stats',
    },
    {
      id: 'experiments',
      label: 'Experiments & Compare',
      icon: 'science',
      badge: experiments.length ? String(experiments.length) : undefined,
    },
    {
      id: 'features-benefits-and-sources',
      label: 'Methodology & Sources',
      icon: 'featured_play_list',
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 lg:hidden animate-fade-in"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-full w-72 bg-surface-container-low z-50 flex flex-col justify-between py-space-md shadow-[0_1px_8px_rgba(0,0,0,0.06)] border-r border-surface-container transition-transform duration-200 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col">
          {/* Header Lab Identity */}
          <div className="px-space-lg py-space-sm mb-space-xs flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-xs">
                <span className="font-label-md text-label-md text-secondary font-semibold uppercase tracking-wider">
                  RuminateX • PS-003
                </span>
              </div>
              {onCloseMobile && (
                <button
                  className="lg:hidden p-1 text-on-surface-variant hover:text-on-surface cursor-pointer rounded-lg hover:bg-surface-container"
                  onClick={onCloseMobile}
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              )}
            </div>
            <button
              onClick={() => onSelectTab('problem-and-overview')}
              className="text-left group cursor-pointer"
            >
              <span className="font-headline-sm text-headline-sm text-primary font-bold tracking-tight mt-space-xs block group-hover:text-secondary transition-colors">
                FedTraffic
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant mt-0.5 block">
                FL Telemetry &amp; Network Evaluator
              </span>
            </button>
          </div>

          {/* Quick Search Shortcut inside sidebar */}
          <div className="px-space-md mb-space-sm">
            <button
              onClick={() => {
                setIsSearchOpen(true);
                if (onCloseMobile) onCloseMobile();
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 bg-surface-container/60 hover:bg-surface-container border border-surface-container-high rounded-lg text-left transition-colors cursor-pointer text-on-surface-variant text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-secondary">search</span>
                <span>Quick Search...</span>
              </div>
              <span className="font-mono text-[10px] bg-surface-container-high px-1.5 py-0.5 rounded">Ctrl+K</span>
            </button>
          </div>

          {/* Interactive Active Cluster Status Card */}
          <div className="px-space-md mb-space-sm">
            <div
              onClick={() => {
                setIsNodeClusterModalOpen(true);
                if (onCloseMobile) onCloseMobile();
              }}
              className="bg-surface-container-lowest p-space-sm rounded-xl flex flex-col gap-space-xs shadow-xs border border-surface-container/80 hover:border-secondary/50 transition-all cursor-pointer group"
              title="Click to open Edge Node Cluster Inspector"
            >
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold group-hover:text-secondary transition-colors">
                  ACTIVE CLUSTER
                </span>
                <span
                  className={`font-label-sm text-label-sm font-semibold flex items-center gap-1 px-1.5 py-0.5 rounded ${
                    backendOnline ? 'text-on-tertiary-container bg-on-tertiary-container/10' : 'text-error bg-error/10'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${backendOnline ? 'bg-on-tertiary-container animate-pulse' : 'bg-error'}`}></span>
                  {backendOnline === null ? 'CONNECTING' : backendOnline ? 'BACKEND ONLINE' : 'BACKEND OFFLINE'}
                </span>
              </div>
              <div className="flex items-center justify-between text-on-surface font-label-md text-label-md">
                <span className="font-bold">{currentClients} Simulated Clients</span>
                <span className="font-label-sm text-label-sm text-secondary font-semibold">
                  {activeExperiment ? activeExperiment.config.partition : 'no run'}
                </span>
              </div>
              <div className="text-[10px] text-on-surface-variant flex items-center justify-between pt-0.5 border-t border-surface-container">
                <span>{activeExperiment ? `Experiment ${activeExperiment.id} • ${activeExperiment.status}` : 'No active experiment'}</span>
                <span className="text-secondary group-hover:underline">Manage Mesh →</span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1 px-space-md">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-space-md py-space-sm rounded-xl text-left transition-all duration-150 font-body-md text-body-md cursor-pointer ${
                    isActive
                      ? 'bg-surface-container-high text-on-surface font-bold shadow-xs border-l-4 border-secondary'
                      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-medium'
                  }`}
                  data-path={item.id}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <div className="flex items-center min-w-0">
                    <span
                      className={`material-symbols-outlined text-[19px] mr-space-sm shrink-0 transition-colors ${
                        isActive ? 'text-secondary' : 'text-on-surface-variant'
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`font-label-sm text-[10px] px-1.5 py-0.2 rounded font-bold uppercase ${
                        item.badge === 'LIVE'
                          ? 'bg-on-tertiary-container/15 text-on-tertiary-container'
                          : 'bg-secondary/15 text-secondary'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Stream & Sync Metrics */}
        <div className="px-space-md flex flex-col gap-space-xs">
          {/* Edge Telemetry Stream Card -> clickable */}
          <div
            onClick={() => {
              onSelectTab('communication-and-convergence-analysis');
              if (onCloseMobile) onCloseMobile();
            }}
            className="bg-surface-container p-space-sm rounded-xl flex flex-col gap-1 border border-surface-container-high hover:border-secondary/40 transition-all cursor-pointer group"
            title="Click to view Communication cost ledger"
          >
            <div className="flex justify-between items-center">
              <span className="font-label-sm text-label-sm text-on-surface-variant group-hover:text-secondary transition-colors font-semibold">
                MEASURED COMMUNICATION
              </span>
              <span className="material-symbols-outlined text-[14px] text-on-surface-variant opacity-75">
                north_east
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-label-md text-label-md font-bold text-on-surface font-mono">
                {networkTransferredMB === null ? '—' : `${networkTransferredMB.toFixed(2)} MB`}
              </span>
              <span className="font-label-sm text-label-sm text-on-tertiary-container font-semibold">
                serialized payloads
              </span>
            </div>
            <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden mt-1">
              <div
                className="bg-secondary h-full transition-all duration-300"
                style={{ width: `${maxRounds ? Math.min(100, (currentRound / maxRounds) * 100) : 0}%` }}
              ></div>
            </div>
          </div>

          {/* Sync Stats */}
          <div className="px-space-xs py-space-xs flex justify-between items-center font-label-sm text-label-sm text-on-surface-variant font-mono">
            <span>Round {currentRound}/{maxRounds}</span>
            <span className="text-secondary font-semibold" title={metricUnit}>MAE: {globalMAE}</span>
          </div>

          {/* Researcher Profile Quick Link in Sidebar */}
          <div
            onClick={() => {
              setIsProfileOpen(true);
              if (onCloseMobile) onCloseMobile();
            }}
            className="p-2 bg-surface-container-lowest/80 rounded-xl flex items-center justify-between border border-surface-container hover:bg-surface-container cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full bg-gradient-to-tr ${
                  userProfile.avatarColor || 'from-secondary to-primary'
                } text-on-primary text-[10px] font-bold flex items-center justify-center shrink-0 shadow-xs`}
              >
                {userProfile.avatarIcon && userProfile.avatarIcon !== 'initials' ? (
                  <span className="material-symbols-outlined text-[14px]">{userProfile.avatarIcon}</span>
                ) : (
                  userProfile.name
                    .trim()
                    .split(/\s+/)
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()
                )}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[11px] font-bold text-on-surface truncate max-w-[120px]">
                  {userProfile.name}
                </span>
                <span className="text-[9px] text-on-surface-variant truncate max-w-[120px]">
                  {userProfile.role}
                </span>
              </div>
            </div>
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant hover:text-secondary transition-colors">
              settings
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};
