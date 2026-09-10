import type { DeploymentDto, ProjectDto, MonitoringSummaryDto } from '@deployxa/sdk';

export type DeployxaNode = ProjectNode | DeploymentNode | MessageNode | SectionNode | MonitoringNode;
export interface ProjectNode { kind: 'project'; project: ProjectDto; }
export interface DeploymentNode { kind: 'deployment'; deployment: DeploymentDto; project: ProjectDto; }
export interface MessageNode { kind: 'message'; label: string; command?: string; }
export interface SectionNode { kind: 'section'; label: string; project?: ProjectDto; }
export interface MonitoringNode { kind: 'monitoring'; project: ProjectDto; summary?: MonitoringSummaryDto; }

export const terminalDeploymentStatuses = new Set(['SUCCESS', 'FAILED', 'CANCELLED', 'ACTIVE', 'ROLLED_BACK']);
export const isDeploymentActive = (status: string) => !terminalDeploymentStatuses.has(status.toUpperCase());
export const deploymentContextValue = (status: string) => status.toUpperCase() === 'SUCCESS' || status.toUpperCase() === 'ACTIVE'
  ? 'deployxa.deployment.success'
  : isDeploymentActive(status) ? 'deployxa.deployment.active' : 'deployxa.deployment';
export const dashboardProjectUrl = (baseUrl: string, projectId: string) => `${baseUrl.replace(/\/$/, '')}/projects/${encodeURIComponent(projectId)}`;
export const dashboardDeploymentUrl = (baseUrl: string, deploymentId: string) => `${baseUrl.replace(/\/$/, '')}/deployments/${encodeURIComponent(deploymentId)}`;
export const nextActiveAccountId = (activeId: string | undefined, removedId: string, remainingIds: string[]) => activeId === removedId ? remainingIds[0] : activeId;
export const deploymentLogText = (logs: unknown) => Array.isArray(logs)
  ? logs.map(entry => {
    const value = entry as { timestamp?: unknown; stream?: unknown; message?: unknown };
    return `[${String(value.timestamp ?? '')}] ${String(value.stream ?? '')}: ${String(value.message ?? '')}`;
  }).join('\n')
  : JSON.stringify(logs, null, 2) ?? String(logs);
