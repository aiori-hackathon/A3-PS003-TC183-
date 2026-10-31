// Typed client for the FedTraffic FastAPI backend (see backend/app/main.py).

const BASE = ((import.meta as any).env?.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ?? '';

export type ExperimentStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type Encoding = 'fp32' | 'fp16' | 'int8' | 'topk';

export interface ExperimentConfig {
  name?: string | null;
  mode: 'federated' | 'centralized';
  dataset_id: string;
  target: string;
  num_sensors: number;
  input_len: number;
  horizon: number;
  train_frac: number;
  val_frac: number;
  eval_stride: number;
  num_clients: number;
  partition: 'contiguous' | 'iid' | 'dirichlet';
  alpha: number;
  rounds: number;
  client_fraction: number;
  client_dropout_prob: number;
  aggregation: 'fedavg' | 'fedprox';
  prox_mu: number;
  local_epochs: number;
  max_local_steps: number;
  batch_size: number;
  learning_rate: number;
  hidden_size: number;
  uplink_encoding: Encoding;
  topk_ratio: number;
  error_feedback: boolean;
  downlink_encoding: 'fp32' | 'fp16' | 'int8';
  uplink_kbps: number;
  downlink_kbps: number;
  seed: number;
  start_paused: boolean;
}

export interface ClientInfo {
  client_id: number;
  name: string;
  label: string;
  sensors: number[];
  num_sensors: number;
  train_windows: number;
  val_windows: number;
  test_windows: number;
  mean_target: number;
  std_target: number;
  raw_training_bytes_kept_local: number;
  heterogeneity_tv: number;
  fedavg_weight: number;
}

export interface ExperimentSummary {
  dataset: {
    id: string;
    name: string;
    source: string;
    sha256: string;
    is_synthetic: boolean;
    interval_minutes: number;
    target: string;
    unit: string;
    sensors_used: number[];
    splits: Record<'train' | 'val' | 'test', { start: string; end: string; steps: number }> & { order: string };
    preprocessing: string[];
  };
  model: { name: string; description: string; parameters: number; fp32_bytes: number; loss: string; optimizer: string };
  evaluation: Record<string, string>;
  communication_accounting: { method: string; description: string; estimated_transfer_time: string };
  environment: Record<string, string | number>;
  federation?: {
    clients: ClientInfo[];
    partition: string;
    alpha: number | null;
    heterogeneity: { mean: number; per_client: number[] };
    aggregation: string;
    weighting: string;
    uplink_encoding: string;
    downlink_encoding: string;
    uplink_payload: string;
    downlink_payload: string;
    raw_training_bytes_total: number;
  };
  centralized?: {
    description: string;
    steps_per_round: number;
    raw_upload_bytes: number;
    raw_upload_definition: string;
    data_owners: { client_id: number; name: string; sensors: number[]; raw_bytes: number }[];
  };
}

export interface FinalMetrics {
  mae: number;
  rmse: number;
  mape: number;
  mae_at_horizon: number;
  rmse_at_horizon: number;
  mae_per_step: number[];
  rmse_per_step: number[];
  observations: number;
  selected_round: number;
  final_round_test?: { mae: number; rmse: number; mape: number };
  per_client_test: { client_id: number; name: string; mae: number; rmse: number; mape: number; mae_at_horizon: number; observations: number }[];
  total_upload_bytes: number;
  total_download_bytes: number;
  total_communication_bytes: number;
  raw_upload_bytes_fp32_equivalent: number;
  uplink_compression_ratio: number | null;
  raw_training_bytes_kept_local: number;
  completed_rounds: number;
  attempted_rounds: number;
  training_time_seconds: number;
  end_to_end_runtime_seconds: number;
  horizon_steps: number;
  horizon_minutes: number;
  unit: string;
}

export interface Experiment {
  id: string;
  name: string;
  mode: 'federated' | 'centralized';
  status: ExperimentStatus;
  config: ExperimentConfig;
  suite_id: string | null;
  suite_label: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  current_round: number;
  completed_rounds: number;
  total_rounds: number;
  paused: boolean;
  summary?: ExperimentSummary | null;
  metrics: FinalMetrics | null;
  end_to_end_runtime_seconds: number | null;
  progress: number;
  has_final_metrics: boolean;
  is_demo_data: boolean;
}

export interface RoundRecord {
  round: number;
  status: 'completed' | 'partial' | 'failed';
  participants: number[];
  successful_clients: number[];
  upload_bytes: number;
  download_bytes: number;
  total_bytes: number;
  raw_upload_bytes: number;
  cumulative_bytes: number;
  val_mae: number;
  val_rmse: number;
  val_mape: number;
  train_loss: number | null;
  client_losses: Record<string, number>;
  duration_s: number;
  elapsed_s: number;
  est_transfer_s: number;
  completed_rounds: number;
}

export interface LedgerEntry {
  round: number;
  client_id: number;
  client_name: string;
  upload_bytes: number;
  download_bytes: number;
  total_bytes: number;
  raw_upload_bytes: number;
  raw_download_bytes: number;
  local_samples: number;
  local_train_loss: number | null;
  train_time_s: number;
  transfer_type: string;
  uplink_encoding: string;
  downlink_encoding: string | null;
  status: 'ok' | 'dropped';
  est_transfer_s: number;
  timestamp: string;
}

export interface Communication {
  experiment_id: string;
  status: ExperimentStatus;
  accounting: ExperimentSummary['communication_accounting'] | null;
  totals: { upload_bytes: number; download_bytes: number; total_bytes: number; raw_upload_bytes: number; completed_rounds: number; ledger_entries: number };
  ledger_matches_reported_totals: boolean | null;
  rounds: Partial<RoundRecord>[];
  ledger: LedgerEntry[];
}

export interface EventEntry {
  id: number;
  experiment_id: string;
  ts: string;
  level: string;
  prefix: string;
  text: string;
}

export interface PredictionTrace {
  client_id: number;
  client_name: string;
  sensor_index: number;
  timestamps: string[];
  actual: number[];
  missing: boolean[];
  predicted_by_step: Record<string, number[]>;
}

export interface Predictions {
  experiment_id: string;
  status: ExperimentStatus;
  available: boolean;
  note?: string;
  unit?: string;
  target?: string;
  horizon_steps?: number;
  interval_minutes?: number;
  checkpoint_round?: number;
  traces: PredictionTrace[];
}

export interface DatasetInfo {
  id: string;
  name: string;
  source: string;
  description: string;
  interval_minutes: number;
  features: string[];
  units: Record<string, string>;
  is_synthetic: boolean;
  available: boolean;
  unavailable_reason: string | null;
  references: string[];
  num_steps?: number;
  num_sensors?: number;
  start_time?: string;
  end_time?: string;
  sha256?: string;
}

export interface PartitionPreview {
  dataset_id: string;
  target: string;
  unit: string;
  partition: string;
  alpha: number | null;
  seed: number;
  heterogeneity: { mean: number; per_client: number[]; metric: string; bins: number };
  level_bins_definition: string;
  splits?: Record<'train' | 'val' | 'test', { start: string; end: string; steps: number }>;
  clients: {
    client_id: number;
    name: string;
    sensors: number[];
    num_sensors: number;
    train_records: number;
    missing_fraction: number;
    mean: number;
    std: number;
    p95: number;
    hourly_profile: (number | null)[];
    level_histogram: number[];
    heterogeneity_tv: number;
    raw_training_bytes: number;
  }[];
}

export interface CompareResult {
  baseline_id: string;
  comparable: boolean;
  issues: { experiment_id: string; severity: string; message: string }[];
  note: string;
  rows: {
    experiment_id: string;
    name: string;
    status: ExperimentStatus;
    mode: string;
    is_baseline: boolean;
    model: string;
    dataset: string;
    target: string;
    horizon_minutes: number;
    mae: number | null;
    rmse: number | null;
    mape: number | null;
    total_communication_bytes: number | null;
    upload_bytes: number | null;
    download_bytes: number | null;
    communication_rounds: number;
    runtime_seconds: number | null;
    training_time_seconds: number | null;
    config_summary: Record<string, unknown>;
    communication_reduction_pct_vs_baseline?: number | null;
    mae_change_pct_vs_baseline?: number | null;
    rmse_change_pct_vs_baseline?: number | null;
  }[];
}

export interface Preset {
  id: string;
  title: string;
  description: string;
  config: ExperimentConfig;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function errorMessage(body: any, status: number): string {
  const d = body?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) {
    return d
      .map((e) => {
        const field = Array.isArray(e.loc) ? e.loc.filter((x: unknown) => x !== 'body').join('.') : '';
        const msg = String(e.msg ?? '').replace(/^Value error, /, '');
        return field ? `${field}: ${msg}` : msg;
      })
      .join('; ');
  }
  return `Request failed (HTTP ${status})`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the backend. Start it with: cd backend && ./run.sh');
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) throw new ApiError(res.status, errorMessage(body, res.status));
  return body as T;
}

const post = <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
  request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body), headers });

export const api = {
  health: () => request<{ status: string; version: string; environment: Record<string, string | number>; running: string[] }>('/api/health'),
  datasets: () => request<DatasetInfo[]>('/api/datasets'),
  partitionPreview: (p: { dataset_id: string; target: string; num_sensors: number; num_clients: number; partition: string; alpha: number; seed: number }) =>
    request<PartitionPreview>(
      `/api/datasets/${p.dataset_id}/partition-preview?` +
        new URLSearchParams({
          target: p.target,
          num_sensors: String(p.num_sensors),
          num_clients: String(p.num_clients),
          partition: p.partition,
          alpha: String(p.alpha),
          seed: String(p.seed),
        })
    ),
  presets: () => request<{ defaults: ExperimentConfig; presets: Preset[] }>('/api/presets'),
  experiments: () => request<Experiment[]>('/api/experiments'),
  experiment: (id: string) => request<Experiment>(`/api/experiments/${id}`),
  create: (cfg: Partial<ExperimentConfig>, idempotencyKey?: string) =>
    post<Experiment>('/api/experiments', cfg, idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined),
  suite: (base: Partial<ExperimentConfig>, include: string[], idempotencyKey?: string) =>
    post<{ suite_id: string; experiments: Experiment[] }>('/api/suites', { base, include }, idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined),
  remove: (id: string) => request<void>(`/api/experiments/${id}`, { method: 'DELETE' }),
  pause: (id: string) => post<Experiment>(`/api/experiments/${id}/pause`),
  resume: (id: string) => post<Experiment>(`/api/experiments/${id}/resume`),
  step: (id: string, count = 1) => post<Experiment>(`/api/experiments/${id}/step`, { count }),
  cancel: (id: string) => post<Experiment>(`/api/experiments/${id}/cancel`),
  rounds: (id: string, since = 0) => request<RoundRecord[]>(`/api/experiments/${id}/rounds?since=${since}`),
  events: (id: string, after = 0) => request<EventEntry[]>(`/api/experiments/${id}/events?after=${after}`),
  communication: (id: string) => request<Communication>(`/api/experiments/${id}/communication`),
  predictions: (id: string) => request<Predictions>(`/api/experiments/${id}/predictions`),
  compare: (ids: string[], baseline?: string) =>
    request<CompareResult>(`/api/compare?ids=${ids.join(',')}${baseline ? `&baseline=${baseline}` : ''}`),
  exportUrl: (id: string, format: 'json' | 'csv', table: 'rounds' | 'ledger' | 'predictions' | 'summary' = 'rounds') =>
    `${BASE}/api/experiments/${id}/export?format=${format}&table=${table}`,
  compareCsvUrl: (ids: string[], baseline?: string) =>
    `${BASE}/api/compare?ids=${ids.join(',')}&format=csv${baseline ? `&baseline=${baseline}` : ''}`,
};

// ------------------------------------------------------------------ formatting helpers

export function formatBytes(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const abs = Math.abs(n);
  if (abs < 1024) return `${n} B`;
  if (abs < 1024 ** 2) return `${(n / 1024).toFixed(digits)} KB`;
  if (abs < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(digits)} MB`;
  return `${(n / 1024 ** 3).toFixed(digits)} GB`;
}

export function fmt(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toFixed(digits);
}

export function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${n > 0 ? '+' : ''}${n.toFixed(digits)}%`;
}

export function downloadUrl(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function downloadText(filename: string, text: string, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
