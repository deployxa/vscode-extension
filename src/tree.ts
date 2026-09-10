import * as vscode from 'vscode';
import type { DeploymentDto, ProjectDto } from '@deployxa/sdk';
import { isUploadRepository } from '@deployxa/sdk';
import type { ClientManager } from './client.js';
import { deploymentContextValue, type DeployxaNode } from './model.js';

export class DeployxaTreeProvider implements vscode.TreeDataProvider<DeployxaNode> {
  private readonly changed = new vscode.EventEmitter<DeployxaNode | undefined>();
  readonly onDidChangeTreeData = this.changed.event;
  private projects: ProjectDto[] = [];
  private deployments = new Map<string, DeploymentDto[]>();
  constructor(private readonly clients: ClientManager) {}
  refresh() { this.projects = []; this.deployments.clear(); this.changed.fire(undefined); }
  getTreeItem(node: DeployxaNode): vscode.TreeItem {
    if (node.kind === 'message') { const item = new vscode.TreeItem(node.label); if (node.command) item.command = { command: node.command, title: node.label }; return item; }
    if (node.kind === 'section') { const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.Collapsed); item.contextValue = 'deployxa.section'; return item; }
    if (node.kind === 'monitoring') {
      const item = new vscode.TreeItem(`${node.project.name} monitoring`, vscode.TreeItemCollapsibleState.None);
      item.description = node.summary?.telemetryAvailable
        ? `${node.summary.containerHealth || 'unknown'} · CPU ${node.summary.cpuPercent}%`
        : 'Monitoring unavailable';
      item.contextValue = 'deployxa.monitoring'; item.iconPath = new vscode.ThemeIcon('pulse'); return item;
    }
    if (node.kind === 'project') {
      const item = new vscode.TreeItem(node.project.name, vscode.TreeItemCollapsibleState.Collapsed);
      item.description = node.project.status; item.contextValue = 'deployxa.project'; item.iconPath = new vscode.ThemeIcon('cloud');
      item.tooltip = `${node.project.framework} · ${isUploadRepository(node.project.repositoryUrl) ? 'Uploaded folder' : node.project.repositoryUrl}`;
      return item;
    }
    const item = new vscode.TreeItem(`${node.deployment.id.slice(0, 8)} · ${node.deployment.status}`);
    item.description = node.deployment.branch || node.project.branch;
    item.contextValue = deploymentContextValue(node.deployment.status);
    item.iconPath = new vscode.ThemeIcon(node.deployment.status === 'SUCCESS' ? 'pass-filled' : node.deployment.status === 'FAILED' ? 'error' : 'sync~spin');
    item.command = { command: 'deployxa.showLogs', title: 'Show Logs', arguments: [node] };
    return item;
  }
  async getChildren(node?: DeployxaNode): Promise<DeployxaNode[]> {
    if (!await this.clients.token()) return [{ kind: 'message', label: 'Sign in to Deployxa', command: 'deployxa.signIn' }];
    if (!node) {
      if (!this.projects.length) this.projects = await this.clients.client().projects.list();
      return this.projects.length ? this.projects.map(project => ({ kind: 'project', project })) : [{ kind: 'message', label: 'No projects found' }];
    }
    if (node.kind === 'section' && node.project) {
      if (node.label === 'Deployments') {
        if (!this.deployments.has(node.project.id)) this.deployments.set(node.project.id, await this.clients.client().deployments.list(node.project.id));
        return (this.deployments.get(node.project.id) || []).slice(0, 20).map(deployment => ({ kind: 'deployment' as const, deployment, project: node.project! }));
      }
      if (node.label === 'Monitoring') {
        const summary = await this.clients.client().monitoring.summary(node.project.id).catch(() => undefined);
        return [{ kind: 'monitoring', project: node.project, summary }];
      }
      return [{ kind: 'message', label: `${node.label} is available through the Deployxa Dashboard.` }];
    }
    if (node.kind !== 'project') return [];
    return [
      { kind: 'section', label: 'Deployments', project: node.project },
      { kind: 'section', label: 'Environment', project: node.project },
      { kind: 'section', label: 'Domains', project: node.project },
      { kind: 'section', label: 'Databases', project: node.project },
      { kind: 'section', label: 'Runtime', project: node.project },
      { kind: 'section', label: 'Monitoring', project: node.project },
      { kind: 'section', label: 'Recent Activity', project: node.project },
    ];
  }
}
