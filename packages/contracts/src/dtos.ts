import type { DeploymentStatus, OrganizationPlan, ProjectStatus, SslStatus, ServiceType } from './enums.js';
import type { Role } from './permissions.js';

export interface PageInfo {
  page: number;
  pageSize: number;
  total?: number;
  hasNextPage?: boolean;
}

export interface Paginated<T> {
  items: T[];
  pageInfo?: PageInfo;
}

export interface UserDto {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  plan: string;
  emailVerified: boolean;
}

export interface OrganizationDto {
  id: string;
  name: string;
  plan: OrganizationPlan | string;
  role?: Role;
  createdAt: string;
  updatedAt?: string;
}

export interface ProjectDto {
  id: string;
  organizationId: string;
  name: string;
  repositoryUrl: string;
  branch: string;
  framework: string;
  status: ProjectStatus | string;
  deploymentUrl?: string | null;
  rootDirectory?: string | null;
  cpuLimit?: number | null;
  ramLimit?: number | null;
  minReplicas?: number;
  maxReplicas?: number;
  activeSlot?: 'BLUE' | 'GREEN' | string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface DeploymentDto {
  id: string;
  projectId: string;
  status: DeploymentStatus | string;
  containerId?: string | null;
  serviceId?: string | null;
  url?: string | null;
  branch?: string | null;
  isPreview?: boolean;
  buildDurationMs?: number | null;
  deployDurationMs?: number | null;
  isCacheHit?: boolean;
  slot?: 'BLUE' | 'GREEN' | string | null;
  standbyUntil?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  version?: DeploymentVersionDto | null;
  project?: Pick<ProjectDto, 'id' | 'name' | 'branch' | 'framework'>;
}

export interface DeploymentVersionDto {
  id: string;
  versionNumber: number;
  commitHash?: string | null;
  commitMessage?: string | null;
  commitAuthor?: string | null;
  createdAt?: string;
}

export interface DomainDto {
  id?: string;
  projectId?: string;
  domain: string;
  dnsVerified?: boolean;
  sslStatus?: SslStatus | string;
  sslExpiresAt?: string | null;
  createdAt?: string;
}

export interface EnvironmentVariableDto {
  id: string;
  projectId: string;
  key: string;
  branch?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DeploymentLogDto {
  id?: string;
  deploymentId: string;
  timestamp: string;
  stream?: string;
  message: string;
}

export interface ArtifactDto {
  id: string;
  projectId: string;
  deploymentId: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  createdAt: string;
}

export interface UsageMetricDto {
  projectId: string;
  cpuHours?: number;
  ramGbHours?: number;
  bandwidthBytes?: number;
  buildMinutes?: number;
  costCents?: number;
  createdAt?: string;
}

export interface InvoiceDto {
  id: string;
  organizationId: string;
  status: string;
  totalCents: number;
  currency?: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  createdAt: string;
}

export interface TemplateDto {
  id: string;
  name: string;
  description?: string;
  framework?: string;
}

export interface CreateProjectRequest {
  name: string;
  repositoryUrl: string;
  branch?: string;
  framework?: string;
  rootDirectory?: string;
}

export interface CreateDeploymentRequest {
  projectId: string;
  branch?: string;
  isPreview?: boolean;
  repoFullName?: string;
  prNumber?: number;
}

export interface SetEnvironmentVariableRequest {
  key: string;
  value: string;
  branch?: string;
}

export interface CreateDomainRequest {
  domain: string;
}

export interface DeploymentDiagnosisDto {
  reason: string;
  solution: string;
  severity: 'warning' | 'critical' | string;
}

export interface DeploymentTimelineDto {
  id: string;
  timestamp: string;
  stream: string;
  message: string;
}

export interface DeploymentProgressDto {
  deploymentId: string;
  status: string;
  stage: string;
  percent: number;
  updatedAt: string;
  timeline: DeploymentTimelineDto[];
}

export interface RichDeploymentProgressDto extends DeploymentProgressDto {
  currentStage: string;
  completed: string[];
  remaining: string[];
  percentage: number;
  rollbackAvailable: boolean;
}

export type ReadinessGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export type ReadinessStatus = 'Ready' | 'Nearly Ready' | 'Not Ready';
export interface ReadinessCheckDto { id: string; passed: boolean; label: string; }
export interface ReadinessDto {
  projectId: string;
  score: number;
  grade: ReadinessGrade;
  status: ReadinessStatus;
  checks: ReadinessCheckDto[];
  recommendations: string[];
  evaluatedAt: string;
}

export interface DnsRecordDto { type: 'A' | 'AAAA' | 'CNAME' | 'TXT'; host: string; value: string; ttl: string | number; }
export interface DomainGuidanceDto {
  projectId: string;
  domain: string;
  status: 'pending' | 'verified' | 'active' | 'failed';
  provider: string;
  records: DnsRecordDto[];
}

export interface DatabaseSummaryDto {
  id: string; projectId: string; name: string; type: string; status: string; version: string | null;
  region: string; size: string; storage: { usedBytes: number; limitBytes: number; percentage: number };
  connectionEndpoint: string | null; connectionLimit: number; activeConnections: number;
  backupStatus: string; createdAt: string; updatedAt: string;
}
export interface DatabaseMetricsDto { databaseId: string; cpuPercent: number; memoryPercent: number; storage: DatabaseSummaryDto['storage']; activeConnections: number; connectionLimit: number; measuredAt: string; }
export interface DatabaseBackupDto {
  id: string;
  databaseId: string;
  status: string;
  sizeBytes?: string | number | null;
  s3Key?: string;
  checksumSha256?: string | null;
  errorReason?: string | null;
  startedAt?: string;
  completedAt?: string | null;
  retentionDays?: number;
  createdAt: string;
  updatedAt?: string;
  restorable?: boolean;
}

export interface CreateDatabaseBackupRequest {
  retentionDays?: number;
}

export interface RestoreDatabaseResponseDto {
  success: boolean;
  message: string;
  restoredBackupId: string;
  durationMs: number;
  restartedContainers: number;
}

export interface RollbackResponseDto {
  message: string;
  instant?: boolean;
  restoredSlot?: string;
  durationMs?: number;
  targetDeploymentId?: string;
  id?: string;
  status?: string;
}

export interface ScheduledTaskRunDto {
  id: string;
  taskId: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'TIMED_OUT' | string;
  exitCode?: number | null;
  outputLogs?: string | null;
  durationMs?: number | null;
  triggeredAt: string;
}

export interface ScheduledTaskDto {
  id: string;
  projectId: string;
  name: string;
  cronExpr: string;
  type: 'HTTP_POST' | 'CONTAINER_EXEC' | string;
  target: string;
  authSecret?: string | null;
  timeoutSec: number;
  enabled: boolean;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  lastStatus?: string | null;
  createdAt: string;
  updatedAt: string;
  runs?: ScheduledTaskRunDto[];
}

export interface CreateScheduledTaskRequest {
  name: string;
  cronExpr: string;
  type: 'HTTP_POST' | 'CONTAINER_EXEC';
  target: string;
  authSecret?: string;
  timeoutSec?: number;
  enabled?: boolean;
}

export interface UpdateScheduledTaskRequest {
  name?: string;
  cronExpr?: string;
  type?: 'HTTP_POST' | 'CONTAINER_EXEC';
  target?: string;
  authSecret?: string;
  timeoutSec?: number;
  enabled?: boolean;
}

export interface ValidateCronResponseDto {
  valid: boolean;
  error?: string;
  nextRunAt?: string | Date;
}
export interface DatabaseUserDto { id: string; databaseId: string; username: string; role: string; connections: number; connectionLimit: number; }

export interface AssistantChatRequest { projectId: string; deploymentId?: string; message: string; }
export interface AssistantActionDto { id: string; label: string; }
export interface AssistantChatDto { answer: string; actions: AssistantActionDto[]; }

export interface MonitoringSummaryDto {
  projectId: string;
  projectName?: string;
  telemetryAvailable?: boolean;
  cpuPercent?: number;
  memoryPercent?: number;
  containerHealth?: string;
  ssl?: string;
  responseTimeMs?: number;
  runningContainers?: number;
  database?: string;
  redis?: string;
  alerts?: Array<{ id?: string; severity?: string; message: string; createdAt?: string }>;
  primaryCondition?: 'healthy' | 'application_unhealthy' | 'deployment_unhealthy' | 'infrastructure_unhealthy' | 'health_probe_failure' | 'application_http_error' | 'startup_failure' | 'monitoring_unavailable';
  diagnostics?: Array<{
    category: NonNullable<MonitoringSummaryDto['primaryCondition']>;
    severity: 'info' | 'warning' | 'critical';
    reason: string;
    deploymentId?: string;
    containerId?: string;
    statusCode?: number;
  }>;
  measuredAt?: string;
}

export interface OperationDto {
  id: string;
  status: string;
  resourceId?: string;
  message?: string;
}

export interface ActivityDto {
  id: string;
  organizationId: string;
  userId?: string | null;
  userEmail?: string | null;
  description: string;
  category: string;
  createdAt: string;
}
export interface NotificationDto { id: string; type?: string; title?: string; message?: string; read?: boolean; createdAt: string; projectId?: string | null; deploymentId?: string | null; domain?: string | null; }
export interface OrganizationMemberDto { id: string; role: string; status?: string; user: { id?: string; name?: string | null; email: string }; }
export interface OrganizationSettingsDto {
  name?: string; defaultRegion?: string; deploymentNotifications?: boolean; securityNotifications?: boolean;
  companyName?: string | null; billingEmail?: string | null; billingAddress?: string | null; vatId?: string | null;
  purchaseOrderNumber?: string | null; allowedDomainSuffix?: string | null; branchProtectionPattern?: string | null;
  envVarPrefixRequirement?: string | null; ipWhitelistPattern?: string | null; mandatorySso?: boolean;
}
export interface ApiTokenDto { id: string; name: string; prefix?: string; scopes?: string[]; createdAt: string; expiresAt?: string | null; lastUsedAt?: string | null; revokedAt?: string | null; }
export interface CreatedApiTokenDto extends ApiTokenDto { secret: string; }
export interface SupportTicketDto { id: string; subject: string; description: string; priority: string; status: string; reply?: string | null; createdAt: string; updatedAt?: string; }
export interface BeginExtensionAuthRequest { state: string; codeChallenge: string; installationId?: string; }
export interface BeginExtensionAuthResponse { flowId: string; authorizationUrl: string; expiresAt: string | Date; }
export interface CompleteExtensionAuthRequest { flowId: string; state: string; }
export interface CompleteExtensionAuthResponse { callbackUrl: string; expiresAt: string | Date; }
export interface ExchangeExtensionCodeRequest { code: string; state: string; codeVerifier: string; installationId?: string; }
export interface ExtensionSessionResponse {
  token: string; tokenType: 'Bearer'; expiresIn: number; organizationId: string;
  user: { userId: string; email: string; name: string | null; plan: string; emailVerified: boolean };
}
export interface BeginGithubExtensionResponse extends BeginExtensionAuthResponse {}
export interface GithubExtensionExchangeResponse { connected: true; organizationId: string; }
export interface GithubRepositoryDto {
  id: string; name: string; fullName: string; url: string; cloneUrl: string; branch: string; private: boolean;
}

export const EXTENSION_ANALYTICS_EVENTS = [
  'extension_activated', 'home_opened', 'registration_clicked', 'registration_completed',
  'extension_authenticated', 'github_connection_started', 'github_connection_completed',
  'project_created', 'workspace_linked', 'first_deployment_started',
  'first_deployment_succeeded', 'first_deployment_failed',
  'upload_deployment_started', 'upload_deployment_succeeded', 'upload_deployment_failed',
] as const;
export type ExtensionAnalyticsEventName = typeof EXTENSION_ANALYTICS_EVENTS[number];
export interface TrackExtensionEventRequest { event: ExtensionAnalyticsEventName; installationId: string; occurredAt?: string; }
export interface TrackExtensionEventResponse { accepted: true; duplicate: boolean; }
export interface ExtensionFunnelStageDto { event: ExtensionAnalyticsEventName; count: number; conversionFromPrevious: number | null; conversionFromActivation: number; }
export interface ExtensionAnalyticsReportDto {
  range: { from: string; to: string };
  stages: ExtensionFunnelStageDto[];
  totalExtensionActivations: number;
  registrationConversion: number;
  authenticationConversion: number;
  githubConnectionConversion: number;
  projectCreationConversion: number;
  firstDeploymentConversion: number;
  successfulFirstDeploymentConversion: number;
  failureRate: number;
  eventsOverTime: Array<{ date: string; event: ExtensionAnalyticsEventName; count: number }>;
  marketplaceDownloadsIncluded: false;
}

export interface AnalyticsOverviewDto {
  range: { from: string; to: string };
  newUsers: number;
  totalRegistrations: number;
  firstDeploymentsStarted: number;
  firstDeploymentsSucceeded: number;
  activationRate: number;
  medianTimeToFirstDeploymentMinutes: number | null;
  d7RetentionRate: number;
  deploymentSuccessRate: number;
  totalDeployments: number;
  successfulDeployments: number;
  failedDeployments: number;
}

export interface AnalyticsFunnelStageDto {
  stage: string;
  eventName: string;
  count: number;
  conversionFromPrevious: number | null;
  conversionFromTop: number;
  dropoffPercentage: number;
  medianTimeFromPreviousMinutes: number | null;
}

export interface AnalyticsFunnelReportDto {
  range: { from: string; to: string };
  stages: AnalyticsFunnelStageDto[];
  activationRate: number;
}

export interface AnalyticsAcquisitionSourceDto {
  source: string;
  visitors: number;
  registrations: number;
  firstDeployments: number;
  successfulFirstDeployments: number;
  activationRate: number;
  conversionRate: number;
}

export interface AnalyticsAcquisitionReportDto {
  range: { from: string; to: string };
  sources: AnalyticsAcquisitionSourceDto[];
  topChannel: string | null;
}

export interface AnalyticsRetentionCohortDto {
  cohortDate: string;
  registeredUsers: number;
  day1Retained: number;
  day1Rate: number;
  day7Retained: number;
  day7Rate: number;
  day30Retained: number;
  day30Rate: number;
}

export interface AnalyticsRetentionReportDto {
  range: { from: string; to: string };
  cohorts: AnalyticsRetentionCohortDto[];
  overallD1Rate: number;
  overallD7Rate: number;
  overallD30Rate: number;
}

export interface AnalyticsRuntimeBreakdownDto {
  runtime: string;
  total: number;
  successful: number;
  failed: number;
  successRate: number;
}

export interface AnalyticsFailureCategoryDto {
  category: string;
  count: number;
  percentage: number;
}

export interface AnalyticsDeploymentHealthDto {
  range: { from: string; to: string };
  totalDeployments: number;
  successfulDeployments: number;
  failedDeployments: number;
  successRate: number;
  averageDurationSeconds: number;
  medianDurationSeconds: number;
  byRuntime: AnalyticsRuntimeBreakdownDto[];
  failuresByCategory: AnalyticsFailureCategoryDto[];
  rollbackRate: number;
  retryRate: number;
}

export interface AnalyticsTimeToValueDto {
  medianRegistrationToFirstDeploymentMinutes: number | null;
  medianProjectCreationToDeploymentMinutes: number | null;
  medianDeploymentStartToSuccessSeconds: number | null;
}

export interface AnalyticsFeatureUsageItemDto {
  feature: string;
  eventName: string;
  totalActions: number;
  uniqueUsers: number;
  uniqueOrganizations: number;
}

export interface AnalyticsFeatureUsageDto {
  range: { from: string; to: string };
  features: AnalyticsFeatureUsageItemDto[];
}

export interface AnalyticsCleanupResponseDto {
  deletedEvents: number;
  deletedSessions: number;
  cutoffDate: string;
}

export interface ServiceEnvironmentVariableDto {
  id?: string;
  key: string;
  value: string;
  isSecret?: boolean;
}

export interface ServiceDependencyDto {
  id?: string;
  serviceId: string;
  dependsOnId: string;
  dependsOnName?: string;
}

export interface CreateServiceDto {
  name: string;
  type?: ServiceType | 'WEB' | 'WORKER' | 'CRON' | 'DATABASE';
  sourceDir?: string;
  repositoryUrl?: string;
  branch?: string;
  buildCommand?: string;
  startCommand?: string;
  internalPort?: number;
  isPublic?: boolean;
  customDomain?: string;
  canvasPositionX?: number;
  canvasPositionY?: number;
  cpuLimitCores?: number;
  memoryLimitMb?: number;
  dependsOnServiceIds?: string[];
  envVars?: Record<string, string>;
}

export interface UpdateServiceDto {
  name?: string;
  type?: ServiceType | 'WEB' | 'WORKER' | 'CRON' | 'DATABASE';
  sourceDir?: string;
  repositoryUrl?: string;
  branch?: string;
  buildCommand?: string;
  startCommand?: string;
  internalPort?: number;
  isPublic?: boolean;
  customDomain?: string;
  canvasPositionX?: number;
  canvasPositionY?: number;
  cpuLimitCores?: number;
  memoryLimitMb?: number;
  dependsOnServiceIds?: string[];
  envVars?: Record<string, string>;
}

export interface CanvasLayoutDto {
  canvasPositionX: number;
  canvasPositionY: number;
}

export interface InterpolatedEnvDto {
  resolved: Record<string, string>;
  unresolvedTokens: string[];
}

export interface ServiceResponseDto {
  id: string;
  projectId: string;
  name: string;
  type: ServiceType | string;
  sourceDir: string;
  repositoryUrl?: string | null;
  branch?: string | null;
  buildCommand?: string | null;
  startCommand?: string | null;
  internalPort: number;
  isPublic: boolean;
  customDomain?: string | null;
  canvasPositionX: number;
  canvasPositionY: number;
  cpuLimitCores: number;
  memoryLimitMb: number;
  envVars?: ServiceEnvironmentVariableDto[];
  dependencies?: { id: string; dependsOnId: string; dependsOnName?: string }[];
  dependents?: { id: string; serviceId: string; serviceName?: string }[];
  activeDeployment?: {
    id: string;
    status: string;
    containerId?: string | null;
    url?: string | null;
    slot?: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

