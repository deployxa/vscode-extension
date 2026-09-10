import type {
  ArtifactDto, CreateDeploymentRequest, CreateDomainRequest, CreateProjectRequest, DeploymentDiagnosisDto,
  DeploymentDto, DeploymentLogDto, DomainDto, EnvironmentVariableDto, InvoiceDto, OrganizationDto,
  ProjectDto, SetEnvironmentVariableRequest, TemplateDto, UsageMetricDto, UserDto, RichDeploymentProgressDto, DeploymentTimelineDto, MonitoringSummaryDto,
  ReadinessDto, DomainGuidanceDto, DatabaseSummaryDto, DatabaseMetricsDto, DatabaseBackupDto, DatabaseUserDto, AssistantChatDto, AssistantChatRequest,
  ActivityDto, NotificationDto, OrganizationMemberDto, OrganizationSettingsDto, ApiTokenDto, CreatedApiTokenDto, SupportTicketDto,
  BeginExtensionAuthRequest, BeginExtensionAuthResponse, ExchangeExtensionCodeRequest, ExtensionSessionResponse,
  BeginGithubExtensionResponse, GithubExtensionExchangeResponse, GithubRepositoryDto,
  TrackExtensionEventRequest, TrackExtensionEventResponse, ExtensionAnalyticsReportDto,
  TrackAnalyticsEventRequest, TrackAnalyticsBatchRequest, TrackAnalyticsEventResponse,
  AnalyticsOverviewDto, AnalyticsFunnelReportDto, AnalyticsAcquisitionReportDto,
  AnalyticsRetentionReportDto, AnalyticsDeploymentHealthDto, AnalyticsTimeToValueDto,
  AnalyticsFeatureUsageDto, AnalyticsCleanupResponseDto, AnalyticsQueryInput,
  ScheduledTaskDto, ScheduledTaskRunDto, CreateScheduledTaskRequest, UpdateScheduledTaskRequest,
  ValidateCronResponseDto, CreateDatabaseBackupRequest, RestoreDatabaseResponseDto, RollbackResponseDto,
  CreateServiceDto, UpdateServiceDto, ServiceResponseDto, CanvasLayoutDto, InterpolatedEnvDto,
} from '@deployxa/contracts';
import type { HttpTransport, RequestOptions } from './transport.js';

const q = (value: string) => encodeURIComponent(value);

export class AuthResource {
  constructor(private t: HttpTransport) {}
  me(o?: RequestOptions) { return this.t.request<UserDto>('GET', '/api/auth/me', undefined, o); }
  logout(o?: RequestOptions) { return this.t.request<{ success?: boolean }>('POST', '/api/auth/logout', {}, o); }
  beginExtensionAuth(input: BeginExtensionAuthRequest, o?: RequestOptions) { return this.t.request<BeginExtensionAuthResponse>('POST', '/api/auth/extension/begin', input, o); }
  exchangeExtensionCode(input: ExchangeExtensionCodeRequest, o?: RequestOptions) { return this.t.request<ExtensionSessionResponse>('POST', '/api/auth/extension/exchange', input, o); }
}
export class ProjectsResource {
  constructor(private t: HttpTransport) {}
  list(o?: RequestOptions) { return this.t.request<ProjectDto[]>('GET', '/api/projects', undefined, o); }
  get(id: string, o?: RequestOptions) { return this.t.request<ProjectDto>('GET', `/api/projects/${q(id)}`, undefined, o); }
  create(input: CreateProjectRequest, o?: RequestOptions) { return this.t.request<ProjectDto>('POST', '/api/projects', input, o); }
  update(id: string, input: Partial<CreateProjectRequest>, o?: RequestOptions) { return this.t.request<ProjectDto>('PATCH', `/api/projects/${q(id)}`, input, o); }
  delete(id: string, o?: RequestOptions) { return this.t.request<{ message: string }>('DELETE', `/api/projects/${q(id)}`, undefined, o); }
  metrics(id: string, o?: RequestOptions) { return this.t.request<UsageMetricDto>('GET', `/api/projects/${q(id)}/metrics`, undefined, o); }
  analyze(id: string, o?: RequestOptions) { return this.t.request<unknown>('GET', `/api/projects/${q(id)}/analyze`, undefined, o); }
}
export class DeploymentsResource {
  constructor(private t: HttpTransport) {}
  create(input: CreateDeploymentRequest, o?: RequestOptions) { return this.t.request<DeploymentDto>('POST', '/api/deployments', input, o); }
  listAll(o?: RequestOptions) { return this.t.request<DeploymentDto[]>('GET', '/api/deployments', undefined, o); }
  list(projectId: string, o?: RequestOptions) { return this.t.request<DeploymentDto[]>('GET', `/api/deployments/project/${q(projectId)}`, undefined, o); }
  get(id: string, o?: RequestOptions) { return this.t.request<DeploymentDto>('GET', `/api/deployments/${q(id)}`, undefined, o); }
  diagnose(id: string, o?: RequestOptions) { return this.t.request<DeploymentDiagnosisDto>('GET', `/api/deployments/${q(id)}/diagnose`, undefined, o); }
  cancel(id: string, o?: RequestOptions) { return this.t.request<unknown>('POST', `/api/deployments/${q(id)}/cancel`, {}, o); }
  rollback(id: string, o?: RequestOptions) { return this.t.request<RollbackResponseDto | DeploymentDto>('POST', `/api/deployments/${q(id)}/rollback`, {}, o); }
  teardownPreview(id: string, o?: RequestOptions) { return this.t.request<{ success: boolean; message: string }>('POST', `/api/deployments/${q(id)}/teardown`, {}, o); }
  deletePreview(id: string, o?: RequestOptions) { return this.teardownPreview(id, o); }
  promote(id: string, o?: RequestOptions) { return this.t.request<unknown>('POST', `/api/deployments/${q(id)}/promote`, {}, o); }
  timeline(id: string, o?: RequestOptions) { return this.t.request<DeploymentTimelineDto[]>('GET', `/api/deployments/${q(id)}/timeline`, undefined, o); }
  progress(id: string, o?: RequestOptions) { return this.t.request<RichDeploymentProgressDto>('GET', `/api/deployments/${q(id)}/progress`, undefined, o); }
  /**
   * Deploy a project by uploading a source archive (.zip/.tar.gz) directly.
   * The archive is streamed as the raw request body; the Engine saves it and
   * queues a build that extracts it instead of cloning a git repository.
   */
  upload(projectId: string, body: BodyInit, filename: string, o?: RequestOptions) {
    const isZip = filename.toLowerCase().endsWith('.zip');
    const headers: Record<string, string> = {
      'Content-Type': isZip ? 'application/zip' : 'application/gzip',
      'Content-Disposition': `attachment; filename="${filename.replace(/["\\]/g, '_')}"`,
    };
    return this.t.sendRaw<DeploymentDto>('POST', `/api/deployments/upload?projectId=${q(projectId)}`, body, headers, o);
  }
}
export class EnvironmentResource {
  constructor(private t: HttpTransport) {}
  list(projectId: string, reveal = false, o?: RequestOptions) { return this.t.request<Array<EnvironmentVariableDto & { value?: string }>>('GET', `/api/projects/${q(projectId)}/env${reveal ? '?decrypt=true' : ''}`, undefined, o); }
  set(projectId: string, input: SetEnvironmentVariableRequest, o?: RequestOptions) { return this.t.request<unknown>('POST', `/api/projects/${q(projectId)}/env`, input, o); }
  delete(id: string, o?: RequestOptions) { return this.t.request<{ message: string }>('DELETE', `/api/projects/env/${q(id)}`, undefined, o); }
}
export class DomainsResource {
  constructor(private t: HttpTransport) {}
  list(projectId: string, o?: RequestOptions) { return this.t.request<DomainDto[]>('GET', `/api/projects/${q(projectId)}/domains`, undefined, o); }
  add(projectId: string, input: CreateDomainRequest, o?: RequestOptions) { return this.t.request<DomainDto>('POST', `/api/projects/${q(projectId)}/domains`, input, o); }
  verify(projectId: string, domain: string, o?: RequestOptions) { return this.t.request<unknown>('POST', `/api/projects/${q(projectId)}/domains/${q(domain)}/verify`, {}, o); }
  delete(projectId: string, domain: string, o?: RequestOptions) { return this.t.request<unknown>('DELETE', `/api/projects/${q(projectId)}/domains/${q(domain)}`, undefined, o); }
}
export class LogsResource { constructor(private t: HttpTransport) {} list(deploymentId: string, o?: RequestOptions) { return this.t.request<DeploymentLogDto[] | { logs: unknown }>('GET', `/api/deployments/${q(deploymentId)}/logs`, undefined, o); } }
export class OrganizationsResource { constructor(private t: HttpTransport) {} list(o?: RequestOptions) { return this.t.request<OrganizationDto[]>('GET', '/api/organizations', undefined, o); } members(o?: RequestOptions) { return this.t.request<OrganizationMemberDto[]>('GET', '/api/organizations/members', undefined, o); } invite(input:{email:string;role:string},o?:RequestOptions){return this.t.request<OrganizationMemberDto>('POST','/api/organizations/members',input,o);} updateMember(id:string,role:string,o?:RequestOptions){return this.t.request<OrganizationMemberDto>('PATCH',`/api/organizations/members/${q(id)}`,{role},o);} removeMember(id:string,o?:RequestOptions){return this.t.request<unknown>('DELETE',`/api/organizations/members/${q(id)}`,undefined,o);} settings(o?:RequestOptions){return this.t.request<OrganizationSettingsDto>('GET','/api/organizations/settings',undefined,o);} updateSettings(input:OrganizationSettingsDto,o?:RequestOptions){return this.t.request<OrganizationSettingsDto>('PATCH','/api/organizations/settings',input,o);} quota(o?:RequestOptions){return this.t.request<Record<string,unknown>>('GET','/api/organizations/quota',undefined,o);} }
export class BillingResource { constructor(private t: HttpTransport) {} usage(projectId: string, o?: RequestOptions) { return this.t.request<UsageMetricDto>('GET', `/api/projects/${q(projectId)}/billing/usage`, undefined, o); } invoices(projectId: string, o?: RequestOptions) { return this.t.request<InvoiceDto[]>('GET', `/api/projects/${q(projectId)}/billing/invoices`, undefined, o); } }
export class ArtifactsResource { constructor(private t: HttpTransport) {} byProject(id: string, o?: RequestOptions) { return this.t.request<ArtifactDto[] | { artifacts: ArtifactDto[] }>('GET', `/api/artifacts/project/${q(id)}`, undefined, o); } byDeployment(id: string, o?: RequestOptions) { return this.t.request<ArtifactDto[]>('GET', `/api/artifacts/deployment/${q(id)}`, undefined, o); } }
export class TemplatesResource { constructor(private t: HttpTransport) {} list(o?: RequestOptions) { return this.t.request<TemplateDto[]>('GET', '/api/templates', undefined, o); } instantiate(id: string, o?: RequestOptions) { return this.t.request<unknown>('POST', `/api/templates/${q(id)}/instantiate`, {}, o); } }
export class RuntimeResource { constructor(private t: HttpTransport) {} restart(projectId: string, o?: RequestOptions) { return this.t.request<unknown>('POST', `/api/projects/${q(projectId)}/restart`, {}, o); } scaling(projectId: string, o?: RequestOptions) { return this.t.request<unknown>('GET', `/api/projects/${q(projectId)}/autoscaling`, undefined, o); } }
export class SslResource { constructor(private t: HttpTransport) {} verify(projectId: string, domain: string, o?: RequestOptions) { return this.t.request<unknown>('POST', `/api/projects/${q(projectId)}/domains/${q(domain)}/verify`, {}, o); } }
export class DatabasesResource { constructor(private t: HttpTransport) {} list(projectId: string, o?: RequestOptions) { return this.t.request<unknown[]>('GET', `/api/projects/${q(projectId)}/databases`, undefined, o); } }
export class DatabaseResource {
  constructor(private t: HttpTransport) {}
  list(projectId: string, o?: RequestOptions) { return this.t.request<DatabaseSummaryDto[]>('GET', `/api/database/projects/${q(projectId)}`, undefined, o); }
  get(databaseId: string, o?: RequestOptions) { return this.t.request<DatabaseSummaryDto>('GET', `/api/database/${q(databaseId)}`, undefined, o); }
  summary(databaseId: string, o?: RequestOptions) { return this.get(databaseId, o); }
  metrics(databaseId: string, o?: RequestOptions) { return this.t.request<DatabaseMetricsDto>('GET', `/api/database/${q(databaseId)}/metrics`, undefined, o); }
  backups(databaseId: string, o?: RequestOptions) { return this.t.request<DatabaseBackupDto[]>('GET', `/api/databases/${q(databaseId)}/backups`, undefined, o); }
  createBackup(databaseId: string, input?: CreateDatabaseBackupRequest, o?: RequestOptions) { return this.t.request<DatabaseBackupDto>('POST', `/api/databases/${q(databaseId)}/backups`, input || {}, o); }
  restoreBackup(databaseId: string, backupId: string, o?: RequestOptions) { return this.t.request<RestoreDatabaseResponseDto>('POST', `/api/databases/${q(databaseId)}/backups/${q(backupId)}/restore`, {}, o); }
  deleteBackup(databaseId: string, backupId: string, o?: RequestOptions) { return this.t.request<{ success: boolean; message: string }>('DELETE', `/api/databases/${q(databaseId)}/backups/${q(backupId)}`, undefined, o); }
  users(databaseId: string, o?: RequestOptions) { return this.t.request<DatabaseUserDto[]>('GET', `/api/database/${q(databaseId)}/users`, undefined, o); }
}

export class CronResource {
  constructor(private t: HttpTransport) {}
  list(projectId: string, o?: RequestOptions) { return this.t.request<ScheduledTaskDto[]>('GET', `/api/projects/${q(projectId)}/cron`, undefined, o); }
  create(projectId: string, input: CreateScheduledTaskRequest, o?: RequestOptions) { return this.t.request<ScheduledTaskDto>('POST', `/api/projects/${q(projectId)}/cron`, input, o); }
  update(projectId: string, taskId: string, input: UpdateScheduledTaskRequest, o?: RequestOptions) { return this.t.request<ScheduledTaskDto>('PATCH', `/api/projects/${q(projectId)}/cron/${q(taskId)}`, input, o); }
  delete(projectId: string, taskId: string, o?: RequestOptions) { return this.t.request<{ success: boolean; message: string }>('DELETE', `/api/projects/${q(projectId)}/cron/${q(taskId)}`, undefined, o); }
  run(projectId: string, taskId: string, o?: RequestOptions) { return this.t.request<ScheduledTaskRunDto>('POST', `/api/projects/${q(projectId)}/cron/${q(taskId)}/run`, {}, o); }
  runs(projectId: string, taskId: string, o?: RequestOptions) { return this.t.request<ScheduledTaskRunDto[]>('GET', `/api/projects/${q(projectId)}/cron/${q(taskId)}/runs`, undefined, o); }
  validate(cronExpr: string, o?: RequestOptions) { return this.t.request<ValidateCronResponseDto>('POST', '/api/projects/cron/validate', { cronExpr }, o); }
}
export class ReadinessResource { constructor(private t: HttpTransport) {} get(projectId: string, o?: RequestOptions) { return this.t.request<ReadinessDto>('GET', `/api/readiness/${q(projectId)}`, undefined, o); } }
export class DnsGuidanceResource { constructor(private t: HttpTransport) {} get(projectId: string, domain?: string, o?: RequestOptions) { return this.t.request<DomainGuidanceDto>('GET', `/api/dns-guidance/${q(projectId)}${domain ? `?domain=${q(domain)}` : ''}`, undefined, o); } }
export class DnsResource {
  constructor(private t: HttpTransport) {}
  guidance(projectId: string, domain?: string, o?: RequestOptions) { return this.t.request<DomainGuidanceDto>('GET', `/api/dns-guidance/${q(projectId)}${domain ? `?domain=${q(domain)}` : ''}`, undefined, o); }
}
export class AssistantResource {
  constructor(private t: HttpTransport) {}
  chat(input: AssistantChatRequest, o?: RequestOptions) { return this.t.request<AssistantChatDto>('POST', '/api/assistant/chat', input, o); }
  diagnose(projectId: string, deploymentId?: string, o?: RequestOptions) {
    return this.chat({ projectId, deploymentId, message: deploymentId ? 'Diagnose this deployment using only Engine evidence.' : 'Diagnose this project using only Engine evidence.' }, o);
  }
}
export class DeploymentProgressResource { constructor(private t: HttpTransport) {} get(deploymentId: string, o?: RequestOptions) { return this.t.request<RichDeploymentProgressDto>('GET', `/api/deployments/${q(deploymentId)}/progress`, undefined, o); } }
export class UsersResource { constructor(private t: HttpTransport) {} me(o?: RequestOptions) { return this.t.request<UserDto>('GET', '/api/auth/me', undefined, o); } }
export class MonitoringResource { constructor(private t: HttpTransport) {} project(projectId: string, o?: RequestOptions) { return this.t.request<MonitoringSummaryDto>('GET', `/api/projects/${q(projectId)}/monitoring`, undefined, o); } summary(projectId: string, o?: RequestOptions) { return this.project(projectId, o); } }
export class MetricsResource { constructor(private t: HttpTransport) {} project(projectId: string, o?: RequestOptions) { return this.t.request<UsageMetricDto>('GET', `/api/projects/${q(projectId)}/metrics`, undefined, o); } }
export class RepositoriesResource {
  constructor(private t: HttpTransport) {}
  list(o?: RequestOptions) { return this.t.request<GithubRepositoryDto[]>('GET', '/api/github/repos', undefined, o); }
  connection(o?: RequestOptions) { return this.t.request<{ connected: boolean; type?: string | null; installationId?: string | null }>('GET', '/api/github/connection', undefined, o); }
  connectionUrl(returnTo = '/dashboard/settings', o?: RequestOptions) { return this.t.request<{ url: string }>('GET', `/api/github/connect?returnTo=${q(returnTo)}`, undefined, o); }
  disconnect(o?: RequestOptions) { return this.t.request<{ success?: boolean; message?: string }>('DELETE', '/api/github/disconnect', undefined, o); }
  beginGithubConnection(input: BeginExtensionAuthRequest, o?: RequestOptions) { return this.t.request<BeginGithubExtensionResponse>('POST', '/api/github/extension/begin', input, o); }
  exchangeGithubCode(input: ExchangeExtensionCodeRequest, o?: RequestOptions) { return this.t.request<GithubExtensionExchangeResponse>('POST', '/api/github/extension/exchange', input, o); }
}
export class NotificationsResource { constructor(private t: HttpTransport) {} list(o?: RequestOptions) { return this.t.request<NotificationDto[]>('GET', '/api/notifications', undefined, o); } markRead(id:string,o?:RequestOptions){return this.t.request<unknown>('PATCH',`/api/notifications/${q(id)}/read`,{},o);} markAllRead(o?:RequestOptions){return this.t.request<unknown>('PATCH','/api/notifications/read-all',{},o);} delete(id:string,o?:RequestOptions){return this.t.request<unknown>('DELETE',`/api/notifications/${q(id)}`,undefined,o);} }
export class AuditResource { constructor(private t: HttpTransport) {} list(o?: RequestOptions) { return this.t.request<unknown[]>('GET', '/api/communication/audit', undefined, o); } }
export class ActivityResource { constructor(private t: HttpTransport) {} list(o?: RequestOptions) { return this.t.request<ActivityDto[]>('GET', '/api/activity', undefined, o); } }
export class ApiTokensResource { constructor(private t: HttpTransport) {} list(o?:RequestOptions){return this.t.request<ApiTokenDto[]>('GET','/api/auth/api-keys',undefined,o);} create(input:{name:string;scopes:string[];expiresAt?:string},o?:RequestOptions){return this.t.request<CreatedApiTokenDto>('POST','/api/auth/api-keys',input,o);} revoke(id:string,o?:RequestOptions){return this.t.request<unknown>('DELETE',`/api/auth/api-keys/${q(id)}`,undefined,o);} }
export class SupportResource { constructor(private t: HttpTransport) {} list(o?:RequestOptions){return this.t.request<SupportTicketDto[]>('GET','/api/support/tickets',undefined,o);} create(input:{subject:string;description:string;priority:string},o?:RequestOptions){return this.t.request<SupportTicketDto>('POST','/api/support/tickets',input,o);} }
export class WorkflowsResource { constructor(private t: HttpTransport) {} deploy(projectId: string, o?: RequestOptions) { return this.t.request<DeploymentDto>('POST', '/api/deployments', { projectId }, o); } rollback(deploymentId: string, o?: RequestOptions) { return this.t.request<DeploymentDto>('POST', `/api/deployments/${q(deploymentId)}/rollback`, {}, o); } }
export class AnalyticsResource {
  constructor(private t: HttpTransport) {}

  track(input: TrackAnalyticsEventRequest, o?: RequestOptions) {
    return this.t.request<TrackAnalyticsEventResponse>('POST', '/api/analytics/events', input, { ...o, retries: 0 });
  }

  trackBatch(input: TrackAnalyticsBatchRequest | TrackAnalyticsEventRequest[], o?: RequestOptions) {
    const body: TrackAnalyticsBatchRequest = Array.isArray(input) ? { events: input } : input;
    return this.t.request<TrackAnalyticsEventResponse>('POST', '/api/analytics/events', body, { ...o, retries: 0 });
  }

  getOverview(query?: AnalyticsQueryInput, o?: RequestOptions) {
    const params = toSearchParams(query);
    return this.t.request<AnalyticsOverviewDto>('GET', `/api/admin/analytics/overview${params}`, undefined, o);
  }

  getFunnel(query?: AnalyticsQueryInput, o?: RequestOptions) {
    const params = toSearchParams(query);
    return this.t.request<AnalyticsFunnelReportDto>('GET', `/api/admin/analytics/funnel${params}`, undefined, o);
  }

  getAcquisition(query?: AnalyticsQueryInput, o?: RequestOptions) {
    const params = toSearchParams(query);
    return this.t.request<AnalyticsAcquisitionReportDto>('GET', `/api/admin/analytics/acquisition${params}`, undefined, o);
  }

  getRetention(query?: AnalyticsQueryInput, o?: RequestOptions) {
    const params = toSearchParams(query);
    return this.t.request<AnalyticsRetentionReportDto>('GET', `/api/admin/analytics/retention${params}`, undefined, o);
  }

  getDeploymentAnalytics(query?: AnalyticsQueryInput, o?: RequestOptions) {
    const params = toSearchParams(query);
    return this.t.request<AnalyticsDeploymentHealthDto>('GET', `/api/admin/analytics/deployments${params}`, undefined, o);
  }

  getTimeToValue(query?: AnalyticsQueryInput, o?: RequestOptions) {
    const params = toSearchParams(query);
    return this.t.request<AnalyticsTimeToValueDto>('GET', `/api/admin/analytics/time-to-value${params}`, undefined, o);
  }

  getFeatureUsage(query?: AnalyticsQueryInput, o?: RequestOptions) {
    const params = toSearchParams(query);
    return this.t.request<AnalyticsFeatureUsageDto>('GET', `/api/admin/analytics/feature-usage${params}`, undefined, o);
  }

  cleanup(retentionDays?: number, o?: RequestOptions) {
    return this.t.request<AnalyticsCleanupResponseDto>('POST', '/api/admin/analytics/cleanup', { retentionDays }, o);
  }

  trackExtensionEvent(input: TrackExtensionEventRequest, o?: RequestOptions) {
    return this.t.request<TrackExtensionEventResponse>('POST', '/api/analytics/extension/events', input, { ...o, retries: 0 });
  }

  extensionReport(from?: string, to?: string, o?: RequestOptions) {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return this.t.request<ExtensionAnalyticsReportDto>('GET', `/api/admin/analytics/extension${params.size ? `?${params}` : ''}`, undefined, o);
  }
}

export class ServicesResource {
  constructor(private t: HttpTransport) {}

  list(projectId: string, o?: RequestOptions) {
    return this.t.request<ServiceResponseDto[]>('GET', `/api/projects/${q(projectId)}/services`, undefined, o);
  }

  get(projectId: string, serviceId: string, o?: RequestOptions) {
    return this.t.request<ServiceResponseDto>('GET', `/api/projects/${q(projectId)}/services/${q(serviceId)}`, undefined, o);
  }

  create(projectId: string, input: CreateServiceDto, o?: RequestOptions) {
    return this.t.request<ServiceResponseDto>('POST', `/api/projects/${q(projectId)}/services`, input, o);
  }

  update(projectId: string, serviceId: string, input: UpdateServiceDto, o?: RequestOptions) {
    return this.t.request<ServiceResponseDto>('PATCH', `/api/projects/${q(projectId)}/services/${q(serviceId)}`, input, o);
  }

  updateLayout(projectId: string, serviceId: string, input: CanvasLayoutDto, o?: RequestOptions) {
    return this.t.request<ServiceResponseDto>('PATCH', `/api/projects/${q(projectId)}/services/${q(serviceId)}/layout`, input, o);
  }

  delete(projectId: string, serviceId: string, o?: RequestOptions) {
    return this.t.request<{ success: boolean; message: string }>('DELETE', `/api/projects/${q(projectId)}/services/${q(serviceId)}`, undefined, o);
  }

  deployEnvironment(projectId: string, input?: { serviceIds?: string[] }, o?: RequestOptions) {
    return this.t.request<{ deployments: any[]; message: string }>('POST', `/api/projects/${q(projectId)}/deploy`, input || {}, o);
  }

  getInterpolatedEnv(projectId: string, serviceId: string, o?: RequestOptions) {
    return this.t.request<InterpolatedEnvDto>('GET', `/api/projects/${q(projectId)}/services/${q(serviceId)}/interpolated-env`, undefined, o);
  }
}


function toSearchParams(query?: Record<string, string | number | boolean | undefined>): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }
  return params.size ? `?${params}` : '';
}

