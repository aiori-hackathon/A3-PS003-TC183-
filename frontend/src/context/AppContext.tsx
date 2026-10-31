import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { PageId, PAGE_IDS } from '../components/Sidebar';
import { sound } from '../utils/audio';
import {
  api,
  ApiError,
  DatasetInfo,
  EventEntry,
  Experiment,
  ExperimentConfig,
  RoundRecord,
} from '../api/client';

export interface UserProfile {
  name: string;
  email: string;
  role: string;
  institution: string;
  department: string;
  location: string;
  phone: string;
  orcid: string;
  bio: string;
  avatarIcon: string;
  avatarColor: string;
  apiToken: string;
  themeColor: 'ocean' | 'emerald' | 'violet' | 'amber';
  units: 'veh_h' | 'veh_min';
  notificationsEnabled: boolean;
  autoRefreshStream: boolean;
  defaultSeed: number;
  lastLogin: string;
}

export interface Toast {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
}

export interface SearchResultItem {
  id: string;
  title: string;
  category: 'Page' | 'Simulation' | 'Metric' | 'Dataset' | 'Subsystem' | 'Action';
  description: string;
  pageId: PageId;
  action?: () => void;
  keywords: string[];
}

/** Settings the simulator page uses for the next experiment it starts. */
export type SimConfig = Pick<
  ExperimentConfig,
  | 'dataset_id'
  | 'target'
  | 'num_sensors'
  | 'num_clients'
  | 'partition'
  | 'alpha'
  | 'rounds'
  | 'local_epochs'
  | 'max_local_steps'
  | 'uplink_encoding'
  | 'topk_ratio'
  | 'client_fraction'
  | 'horizon'
  | 'seed'
>;

export interface AppContextType {
  activeTab: PageId;
  setActiveTab: (tab: PageId) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  isProfileOpen: boolean;
  setIsProfileOpen: (open: boolean) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  isNodeClusterModalOpen: boolean;
  setIsNodeClusterModalOpen: (open: boolean) => void;
  isReportOpen: boolean;
  setIsReportOpen: (open: boolean) => void;
  isShortcutsOpen: boolean;
  setIsShortcutsOpen: (open: boolean) => void;
  isSoundMuted: boolean;
  toggleSound: () => void;
  userProfile: UserProfile;
  updateUserProfile: (profile: Partial<UserProfile>) => void;
  resetUserProfile: () => void;

  // Backend connection
  backendOnline: boolean | null;
  datasets: DatasetInfo[];
  experiments: Experiment[];
  refreshExperiments: () => Promise<void>;

  // Active experiment (drives the simulator and dashboards)
  activeExperimentId: string | null;
  activeExperiment: Experiment | null;
  activeRounds: RoundRecord[];
  activeEvents: EventEntry[];
  selectExperiment: (id: string | null) => void;
  simConfig: SimConfig;
  setSimConfig: (patch: Partial<SimConfig>) => void;
  startExperiment: (overrides?: Partial<ExperimentConfig>) => Promise<Experiment | null>;
  simBusy: boolean;
  metricUnit: string;
  maeKind: 'test' | 'validation' | null;

  // Simulator state derived from the active experiment
  currentRound: number;
  maxRounds: number;
  currentClients: number;
  currentAlpha: number;
  currentSeed: number;
  isPlaying: boolean;
  networkTransferredMB: number | null;
  globalMAE: string;
  globalRMSE: string;
  stepRound: (count?: number) => void;
  fastForwardToRound: (round: number) => void;
  resetSimulator: () => void;
  togglePlaySimulator: () => void;
  setCurrentClients: (clients: number) => void;
  setCurrentAlpha: (alpha: number) => void;
  setCurrentSeed: (seed: number) => void;

  // Notification Toasts
  toasts: Toast[];
  addToast: (title: string, message: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;
}

const defaultProfile: UserProfile = {
  name: 'RuminateX Team',
  email: 'team@ruminatex.local',
  role: 'Project Demonstrator',
  institution: 'AIORI Hackathon 3',
  department: 'PS-003 Federated Traffic-Flow Prediction',
  location: '',
  phone: '',
  orcid: '',
  bio: 'Federated traffic forecasting with communication-cost evaluation.',
  avatarIcon: 'person',
  avatarColor: 'from-secondary to-primary',
  apiToken: '',
  themeColor: 'ocean',
  units: 'veh_h',
  notificationsEnabled: true,
  autoRefreshStream: true,
  defaultSeed: 42,
  lastLogin: 'Local session',
};

const defaultSimConfig: SimConfig = {
  dataset_id: 'pems04',
  target: 'flow',
  num_sensors: 50,
  num_clients: 5,
  partition: 'dirichlet',
  alpha: 0.5,
  rounds: 20,
  local_epochs: 1,
  max_local_steps: 40,
  uplink_encoding: 'fp32',
  topk_ratio: 0.05,
  client_fraction: 1,
  horizon: 12,
  seed: 42,
};

const ACTIVE_STATUSES = ['queued', 'running'];
export const isActiveStatus = (s?: string | null) => !!s && ACTIVE_STATUSES.includes(s);

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const getInitialTab = (): PageId => {
    const hash = window.location.hash.replace('#', '');
    return (PAGE_IDS as string[]).includes(hash) ? (hash as PageId) : 'problem-and-overview';
  };

  const [activeTab, setActiveTabState] = useState<PageId>(getInitialTab);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isNodeClusterModalOpen, setIsNodeClusterModalOpen] = useState<boolean>(false);
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
  const [isSoundMuted, setIsSoundMuted] = useState<boolean>(() => sound.getMuted());

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);
  const addToast = useCallback(
    (title: string, message: string, type: Toast['type'] = 'info') => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev.slice(-4), { id, title, message, type }]);
      setTimeout(() => removeToast(id), type === 'error' ? 7000 : 4000);
    },
    [removeToast]
  );

  const toggleSound = () => {
    const nextMuted = sound.toggleMute();
    setIsSoundMuted(nextMuted);
    addToast(nextMuted ? 'Audio Feedback Muted' : 'Audio Feedback Enabled', nextMuted ? 'Sounds muted.' : 'Sounds enabled.', 'info');
  };

  // Profile with local storage
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('fedtraffic_user_profile');
      if (saved) return { ...defaultProfile, ...JSON.parse(saved) };
    } catch {
      // Ignore storage errors
    }
    return defaultProfile;
  });

  const updateUserProfile = (newFields: Partial<UserProfile>) => {
    setUserProfile((prev) => {
      const updated = { ...prev, ...newFields };
      try {
        localStorage.setItem('fedtraffic_user_profile', JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });
    addToast('Profile Updated', 'Your settings and preferences have been saved in this browser.', 'success');
  };

  const resetUserProfile = () => {
    setUserProfile(defaultProfile);
    try {
      localStorage.removeItem('fedtraffic_user_profile');
    } catch {
      // Ignore
    }
    addToast('Profile Reset', 'Preferences restored to default configuration.', 'info');
  };

  // ------------------------------------------------------------------ backend state

  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [activeExperimentId, setActiveExperimentId] = useState<string | null>(() => localStorage.getItem('fedtraffic_active_experiment'));
  const [activeExperiment, setActiveExperiment] = useState<Experiment | null>(null);
  const [activeRounds, setActiveRounds] = useState<RoundRecord[]>([]);
  const [activeEvents, setActiveEvents] = useState<EventEntry[]>([]);
  const [simBusy, setSimBusy] = useState(false);
  const [simConfig, setSimConfigState] = useState<SimConfig>(() => {
    try {
      const saved = localStorage.getItem('fedtraffic_sim_config');
      if (saved) return { ...defaultSimConfig, ...JSON.parse(saved) };
    } catch {
      // Ignore
    }
    return defaultSimConfig;
  });

  const setSimConfig = useCallback((patch: Partial<SimConfig>) => {
    setSimConfigState((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem('fedtraffic_sim_config', JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  const reportError = useCallback(
    (title: string, e: unknown) => {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e);
      if (e instanceof ApiError && e.status === 0) setBackendOnline(false);
      sound.playAlert();
      addToast(title, msg, 'error');
    },
    [addToast]
  );

  const refreshExperiments = useCallback(async () => {
    try {
      const list = await api.experiments();
      setExperiments(list);
      setBackendOnline(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) setBackendOnline(false);
    }
  }, []);

  // Initial load: datasets + experiments; pick the most recent experiment if none is selected.
  useEffect(() => {
    (async () => {
      try {
        const [ds, list] = await Promise.all([api.datasets(), api.experiments()]);
        setDatasets(ds);
        setExperiments(list);
        setBackendOnline(true);
        const stored = localStorage.getItem('fedtraffic_active_experiment');
        if (!stored || !list.some((e) => e.id === stored)) {
          const pick = list.find((e) => e.mode === 'federated' && (isActiveStatus(e.status) || e.status === 'completed')) ?? list[0];
          setActiveExperimentId(pick ? pick.id : null);
        }
      } catch {
        setBackendOnline(false);
      }
    })();
  }, []);

  // Reconnect / periodic list refresh.
  const anyActive = experiments.some((e) => isActiveStatus(e.status));
  useEffect(() => {
    const ms = backendOnline === false ? 4000 : anyActive ? 3000 : 15000;
    const t = setInterval(async () => {
      if (backendOnline === false) {
        try {
          await api.health();
          setBackendOnline(true);
          setDatasets(await api.datasets());
          addToast('Backend Connected', 'Connection to the experiment server restored.', 'success');
        } catch {
          return;
        }
      }
      refreshExperiments();
    }, ms);
    return () => clearInterval(t);
  }, [backendOnline, anyActive, refreshExperiments, addToast]);

  // Persist selection.
  useEffect(() => {
    if (activeExperimentId) localStorage.setItem('fedtraffic_active_experiment', activeExperimentId);
    else localStorage.removeItem('fedtraffic_active_experiment');
  }, [activeExperimentId]);

  // Load and poll the active experiment.
  const lastRoundRef = useRef(0);
  const lastEventRef = useRef(0);
  const prevStatusRef = useRef<string | null>(null);

  useEffect(() => {
    setActiveExperiment(null);
    setActiveRounds([]);
    setActiveEvents([]);
    lastRoundRef.current = 0;
    lastEventRef.current = 0;
    prevStatusRef.current = null;
    if (!activeExperimentId || backendOnline === false) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      try {
        const [exp, rds, evs] = await Promise.all([
          api.experiment(activeExperimentId),
          api.rounds(activeExperimentId, lastRoundRef.current),
          api.events(activeExperimentId, lastEventRef.current),
        ]);
        if (cancelled) return;
        if (rds.length) {
          lastRoundRef.current = rds[rds.length - 1].round;
          setActiveRounds((prev) => [...prev.filter((r) => r.round < rds[0].round), ...rds]);
        }
        if (evs.length) {
          lastEventRef.current = evs[evs.length - 1].id;
          setActiveEvents((prev) => [...prev, ...evs].slice(-600));
        }
        setActiveExperiment(exp);
        setExperiments((prev) => prev.map((e) => (e.id === exp.id ? { ...e, ...exp } : e)));

        const prev = prevStatusRef.current;
        if (prev && isActiveStatus(prev) && !isActiveStatus(exp.status)) {
          if (exp.status === 'completed') {
            sound.playSuccess();
            addToast('Experiment Completed', `${exp.name}: test MAE ${exp.metrics?.mae.toFixed(2)} ${exp.metrics?.unit}, ${exp.completed_rounds} rounds.`, 'success');
          } else if (exp.status === 'failed') {
            sound.playAlert();
            addToast('Experiment Failed', exp.error ?? 'Unknown error', 'error');
          } else if (exp.status === 'cancelled') {
            addToast('Experiment Cancelled', `${exp.completed_rounds} round(s) were completed before cancellation.`, 'warning');
          }
          refreshExperiments();
        } else if (prev && rds.length && isActiveStatus(exp.status)) {
          sound.playStep();
        }
        prevStatusRef.current = exp.status;
        if (isActiveStatus(exp.status)) timer = setTimeout(tick, 1000);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) {
          setActiveExperimentId(null);
          return;
        }
        if (e instanceof ApiError && e.status === 0) setBackendOnline(false);
        timer = setTimeout(tick, 3000);
      }
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [activeExperimentId, backendOnline, addToast, refreshExperiments]);

  const selectExperiment = useCallback((id: string | null) => setActiveExperimentId(id), []);

  // ------------------------------------------------------------------ actions

  const startExperiment = useCallback(
    async (overrides: Partial<ExperimentConfig> = {}) => {
      setSimBusy(true);
      try {
        const cfg: Partial<ExperimentConfig> = { mode: 'federated', ...simConfig, ...overrides };
        const exp = await api.create(cfg, `ui-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
        setActiveExperimentId(exp.id);
        setExperiments((prev) => [exp, ...prev.filter((e) => e.id !== exp.id)]);
        addToast('Experiment Started', `${exp.name} (id ${exp.id}) was queued on the backend.`, 'success');
        return exp;
      } catch (e) {
        reportError('Could Not Start Experiment', e);
        return null;
      } finally {
        setSimBusy(false);
      }
    },
    [simConfig, addToast, reportError]
  );

  const exp = activeExperiment;
  const expIsLive = !!exp && isActiveStatus(exp.status);

  const togglePlaySimulator = async () => {
    sound.playTick();
    try {
      if (!exp || !expIsLive) {
        await startExperiment({ start_paused: false });
      } else if (exp.paused) {
        setActiveExperiment(await api.resume(exp.id));
        addToast('Training Resumed', 'Rounds will run continuously until the round limit.', 'info');
      } else {
        setActiveExperiment(await api.pause(exp.id));
        addToast('Pausing', 'Training pauses after the current round finishes.', 'info');
      }
    } catch (e) {
      reportError('Control Failed', e);
    }
  };

  const stepRound = async (count: number = 1) => {
    sound.playStep();
    try {
      if (!exp || !expIsLive) {
        const created = await startExperiment({ start_paused: true });
        if (created) setActiveExperiment(await api.step(created.id, count));
      } else {
        setActiveExperiment(await api.step(exp.id, count));
        addToast(`Run ${count} Round${count > 1 ? 's' : ''}`, `The server will execute ${count} more FedAvg round(s), then pause.`, 'info');
      }
    } catch (e) {
      reportError('Step Failed', e);
    }
  };

  const fastForwardToRound = async (round: number) => {
    sound.playSuccess();
    try {
      if (!exp || !expIsLive) {
        await startExperiment({ start_paused: false });
        return;
      }
      const target = Math.min(exp.total_rounds, round);
      if (target >= exp.total_rounds) setActiveExperiment(await api.resume(exp.id));
      else if (target > exp.current_round) setActiveExperiment(await api.step(exp.id, target - exp.current_round));
    } catch (e) {
      reportError('Fast-Forward Failed', e);
    }
  };

  const resetSimulator = async () => {
    sound.playAlert();
    try {
      if (exp && expIsLive) await api.cancel(exp.id);
    } catch (e) {
      reportError('Cancel Failed', e);
    }
    setActiveExperimentId(null);
    refreshExperiments();
    addToast('Simulator Reset', 'Cleared the active experiment. Press Run or Step to train a new global model from scratch.', 'warning');
  };

  const notifyNextRun = () => {
    if (expIsLive) addToast('Applies to Next Run', 'The running experiment keeps its settings; changes apply to the next experiment you start.', 'info');
  };
  const setCurrentClients = (c: number) => {
    setSimConfig({ num_clients: c });
    notifyNextRun();
  };
  const setCurrentAlpha = (a: number) => {
    setSimConfig(a > 10 ? { partition: 'iid', alpha: a } : { partition: 'dirichlet', alpha: a });
    notifyNextRun();
  };
  const setCurrentSeed = (s: number) => {
    setSimConfig({ seed: s });
    notifyNextRun();
  };

  // ------------------------------------------------------------------ derived values

  const lastRound = activeRounds.length ? activeRounds[activeRounds.length - 1] : null;
  const completed = exp?.status === 'completed' && exp.metrics;
  const globalMAE = completed ? exp!.metrics!.mae.toFixed(2) : lastRound ? lastRound.val_mae.toFixed(2) : '—';
  const globalRMSE = completed ? exp!.metrics!.rmse.toFixed(2) : lastRound ? lastRound.val_rmse.toFixed(2) : '—';
  const maeKind: AppContextType['maeKind'] = completed ? 'test' : lastRound ? 'validation' : null;
  const networkTransferredMB = completed
    ? exp!.metrics!.total_communication_bytes / 1024 ** 2
    : lastRound
    ? lastRound.cumulative_bytes / 1024 ** 2
    : null;
  const metricUnit = exp?.summary?.dataset.unit ?? exp?.metrics?.unit ?? 'veh/5min';
  const cfg = exp?.config;

  // ------------------------------------------------------------------ navigation & shortcuts

  const setActiveTab = (tab: PageId) => {
    setActiveTabState(tab);
    window.location.hash = tab;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if ((PAGE_IDS as string[]).includes(hash)) setActiveTabState(hash as PageId);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Keyboard handler reads the latest actions through a ref (avoids stale closures).
  const actionsRef = useRef({ togglePlaySimulator, stepRound, resetSimulator, setActiveTab });
  actionsRef.current = { togglePlaySimulator, stepRound, resetSimulator, setActiveTab };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        sound.playTick();
        setIsSearchOpen((prev) => !prev);
        return;
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setIsProfileOpen(false);
        setIsNodeClusterModalOpen(false);
        setIsReportOpen(false);
        setIsShortcutsOpen(false);
        return;
      }
      if (isInput || e.ctrlKey || e.metaKey || e.altKey) return;

      const a = actionsRef.current;
      const pageIdx = parseInt(e.key, 10);
      if (pageIdx >= 1 && pageIdx <= PAGE_IDS.length) {
        e.preventDefault();
        sound.playTick();
        a.setActiveTab(PAGE_IDS[pageIdx - 1]);
      } else if (e.key === '?') {
        e.preventDefault();
        sound.playTick();
        setIsShortcutsOpen((prev) => !prev);
      } else if (e.code === 'Space') {
        e.preventDefault();
        a.togglePlaySimulator();
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        a.stepRound(1);
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        a.resetSimulator();
      } else if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        sound.playTick();
        setIsProfileOpen((prev) => !prev);
      } else if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        sound.playTick();
        setIsNodeClusterModalOpen((prev) => !prev);
      } else if (e.key.toLowerCase() === 'e') {
        e.preventDefault();
        sound.playTick();
        setIsReportOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        isMobileMenuOpen,
        setIsMobileMenuOpen,
        isProfileOpen,
        setIsProfileOpen,
        isSearchOpen,
        setIsSearchOpen,
        isNodeClusterModalOpen,
        setIsNodeClusterModalOpen,
        isReportOpen,
        setIsReportOpen,
        isShortcutsOpen,
        setIsShortcutsOpen,
        isSoundMuted,
        toggleSound,
        userProfile,
        updateUserProfile,
        resetUserProfile,
        backendOnline,
        datasets,
        experiments,
        refreshExperiments,
        activeExperimentId,
        activeExperiment,
        activeRounds,
        activeEvents,
        selectExperiment,
        simConfig,
        setSimConfig,
        startExperiment,
        simBusy,
        metricUnit,
        maeKind,
        currentRound: exp?.current_round ?? 0,
        maxRounds: exp?.total_rounds ?? simConfig.rounds,
        currentClients: cfg?.num_clients ?? simConfig.num_clients,
        currentAlpha: cfg ? (cfg.partition === 'iid' ? 100 : cfg.alpha) : simConfig.partition === 'iid' ? 100 : simConfig.alpha,
        currentSeed: cfg?.seed ?? simConfig.seed,
        isPlaying: expIsLive && !exp!.paused,
        networkTransferredMB,
        globalMAE,
        globalRMSE,
        stepRound,
        fastForwardToRound,
        resetSimulator,
        togglePlaySimulator,
        setCurrentClients,
        setCurrentAlpha,
        setCurrentSeed,
        toasts,
        addToast,
        removeToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
