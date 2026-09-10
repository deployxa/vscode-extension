import * as vscode from 'vscode';
import type { DeploymentDto, ProjectDto, MonitoringSummaryDto } from '@deployxa/sdk';

export interface ProjectMonitoring { project: ProjectDto; summary?: MonitoringSummaryDto; }

export class DeployxaDashboard implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  constructor(private readonly extensionUri: vscode.Uri, private readonly read: () => Promise<{ projects: ProjectDto[]; deployments: DeploymentDto[]; monitoring?: ProjectMonitoring[] }>) {}
  resolveWebviewView(view: vscode.WebviewView) {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.onDidReceiveMessage(message => { if (message.type === 'refresh') void this.refresh(); });
    void this.refresh();
  }
  async refresh() {
    if (!this.view) return;
    try { const data = await this.read(); this.view.webview.html = this.html(data); }
    catch (error) { this.view.webview.html = this.html({ projects: [], deployments: [], monitoring: [], error: error instanceof Error ? error.message : String(error) }); }
  }
  private html(data: { projects: ProjectDto[]; deployments: DeploymentDto[]; monitoring?: ProjectMonitoring[]; error?: string }) {
    const projects = data.projects.map(project => `<article><strong>${escapeHtml(project.name)}</strong><span>${escapeHtml(project.framework)} · ${escapeHtml(project.status)}</span></article>`).join('');
    const deployments = data.deployments.slice(0, 10).map(deployment => `<li><b>${escapeHtml(deployment.status)}</b> <code>${escapeHtml(deployment.id.slice(0, 8))}</code><small>${escapeHtml(deployment.url || deployment.branch || '')}</small></li>`).join('');
    const monitoring = (data.monitoring || []).map(({ project, summary }) => {
      if (!summary?.telemetryAvailable) return `<article><strong>${escapeHtml(project.name)}</strong><span>Monitoring unavailable</span><span>Containers ${summary?.runningContainers ?? 0} · Health ${escapeHtml(summary?.containerHealth || 'unavailable')} · SSL ${escapeHtml(summary?.ssl || 'unknown')}</span></article>`;
      return `<article><strong>${escapeHtml(summary.projectName || project.name)}</strong><span>CPU ${summary.cpuPercent}% · Memory ${summary.memoryPercent}% · Containers ${summary.runningContainers}</span><span>Health ${escapeHtml(summary.containerHealth || 'unknown')} · SSL ${escapeHtml(summary.ssl || 'unknown')}</span></article>`;
    }).join('');
    return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-deployxa'"><style>body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);padding:10px}article,li{display:flex;flex-direction:column;gap:3px;padding:8px 0;border-bottom:1px solid var(--vscode-panel-border)}span,small{opacity:.7}button{margin-bottom:10px}</style></head><body><button id="refresh">Refresh</button>${data.error ? `<p>${escapeHtml(data.error)}</p>` : `<h3>Projects</h3>${projects || '<p>No projects</p>'}<h3>Recent deployments</h3><ul>${deployments || '<li>No deployments</li>'}</ul><h3>Monitoring</h3>${monitoring || '<p>No monitoring data</p>'}` }<script nonce="deployxa">const vscode=acquireVsCodeApi();document.getElementById('refresh')?.addEventListener('click',()=>vscode.postMessage({type:'refresh'}));</script></body></html>`;
  }
}
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character)); }
