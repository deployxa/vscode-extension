export const ProjectStatus = {
  Idle: 'idle',
  Building: 'building',
  Deploying: 'deploying',
  Active: 'active',
  Failed: 'failed',
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const DeploymentStatus = {
  Queued: 'QUEUED',
  Building: 'BUILDING',
  Deploying: 'DEPLOYING',
  Success: 'SUCCESS',
  Failed: 'FAILED',
  Cancelled: 'CANCELLED',
} as const;
export type DeploymentStatus = (typeof DeploymentStatus)[keyof typeof DeploymentStatus];

export const BuildStatus = {
  Queued: 'queued',
  Running: 'running',
  Completed: 'completed',
  Failed: 'failed',
} as const;
export type BuildStatus = (typeof BuildStatus)[keyof typeof BuildStatus];

export const SslStatus = {
  Pending: 'pending',
  Active: 'active',
  Failed: 'failed',
} as const;
export type SslStatus = (typeof SslStatus)[keyof typeof SslStatus];

export const OrganizationPlan = {
  Free: 'free',
  Developer: 'developer',
  Starter: 'starter',
  Pro: 'pro',
  Team: 'team',
  Business: 'business',
  Enterprise: 'enterprise',
} as const;
export type OrganizationPlan = (typeof OrganizationPlan)[keyof typeof OrganizationPlan];

export const BackupStatus = {
  Pending: 'PENDING',
  Running: 'RUNNING',
  Completed: 'COMPLETED',
  Failed: 'FAILED',
  Restoring: 'RESTORING',
} as const;
export type BackupStatus = (typeof BackupStatus)[keyof typeof BackupStatus];

export const CronType = {
  HttpPost: 'HTTP_POST',
  ContainerExec: 'CONTAINER_EXEC',
} as const;
export type CronType = (typeof CronType)[keyof typeof CronType];

export const ServiceType = {
  Web: 'WEB',
  Worker: 'WORKER',
  Cron: 'CRON',
  Database: 'DATABASE',
} as const;
export type ServiceType = (typeof ServiceType)[keyof typeof ServiceType];
