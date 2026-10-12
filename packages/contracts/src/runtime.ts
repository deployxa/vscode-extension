export type RuntimeCommandType =
  | 'container.start'
  | 'container.stop'
  | 'container.restart'
  | 'container.remove'
  | 'image.remove';

export interface RuntimeCommand<TPayload = Record<string, unknown>> {
  id: string;
  type: RuntimeCommandType;
  payload: TPayload;
  requestedAt: string;
  organizationId?: string;
  correlationId?: string;
}

export interface RuntimeResult<TData = unknown> {
  commandId: string;
  status: 'accepted' | 'completed' | 'failed';
  data?: TData;
  error?: { code: string; message: string };
  completedAt?: string;
}

export type HealthProbeType = 'tcp' | 'http' | 'https';

export interface HealthStatusRange {
  min: number;
  max: number;
}

export interface HealthCheckConfiguration {
  type: HealthProbeType;
  path?: string;
  expectedStatuses?: HealthStatusRange[];
  followRedirects?: boolean;
  startupGracePeriodMs?: number;
  intervalMs?: number;
  timeoutMs?: number;
  retries?: number;
}

export interface HealthCheckDiagnostic {
  healthy: boolean;
  attempts: number;
  target: string;
  status?: number;
  reason?: 'connection_refused' | 'timeout' | 'unexpected_status' | 'missing_route' | 'placeholder_page' | 'tls_error' | 'probe_error';
  message?: string;
}
