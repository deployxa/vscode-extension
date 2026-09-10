import * as vscode from 'vscode';
import type { DeploymentDto, RichDeploymentProgressDto, MonitoringSummaryDto, ProjectDto } from '@deployxa/sdk';
import { isUploadRepository } from '@deployxa/sdk';
import type { ClientManager } from './client.js';
import { readRepository } from './local.js';
import type { FunnelTracker } from './funnel.js';

export interface HomeAction { type: 'command'; command: string; args?: unknown[]; }
export interface HomeData {
  signedIn: boolean;
  account?: { email: string; name?: string | null };
  organization?: { id: string; name: string };
  projects: ProjectDto[];
  deployments: Array<DeploymentDto & { projectName?: string }>;
  monitoring: MonitoringSummaryDto[];
  monitoringProject?: string;
  deploymentsToday?: number;
  workspace?: { remoteUrl: string; branch: string; project?: ProjectDto; linked: boolean };
  mode: 'simple' | 'advanced';
  progress?: { project: ProjectDto; deployment: DeploymentDto; update?: RichDeploymentProgressDto };
  error?: string;
}

export class DeployxaHome implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private mode: 'simple' | 'advanced' = 'simple';
  private progress?: HomeData['progress'];
  private lastData?: HomeData;
  private loading = false;

  constructor(private readonly clients: ClientManager, private readonly context: vscode.ExtensionContext, private readonly funnel?: FunnelTracker) {
    this.mode = context.globalState.get<'simple' | 'advanced'>('deployxa.uiMode', 'simple');
  }

  resolveWebviewView(view: vscode.WebviewView) {
    this.view = view;
    void this.funnel?.record('home_opened');
    view.webview.options = { enableScripts: true };
    view.webview.onDidReceiveMessage((message: HomeAction | { type: 'mode'; mode: 'simple' | 'advanced' }) => {
      if (message.type === 'mode') { void this.setMode(message.mode); return; }
      if (message.type === 'command') void vscode.commands.executeCommand(message.command, ...(message.args || []));
    }, undefined, this.context.subscriptions);
    void this.refresh();
  }

  async setMode(mode: 'simple' | 'advanced') {
    this.mode = mode;
    await this.context.globalState.update('deployxa.uiMode', mode);
    await this.refresh();
  }

  async refresh() {
    if (!this.view || this.loading) return;
    if (this.progress && this.lastData) {
      this.lastData = { ...this.lastData, mode: this.mode, progress: this.progress };
      this.view.webview.html = this.html(this.lastData);
      return;
    }
    this.loading = true;
    try {
      const token = await this.clients.token();
      const data: HomeData = { signedIn: Boolean(token), account: this.clients.activeAccount() || undefined, projects: [], deployments: [], monitoring: [], mode: this.mode, progress: this.progress };
      if (token) {
        const [user, organizations, projects] = await Promise.all([this.clients.client().auth.me().catch(() => undefined), this.clients.client().organizations.list().catch(() => []), this.clients.client().projects.list()]);
        data.account = user ? { email: user.email, name: user.name } : data.account;
        const organizationId = vscode.workspace.getConfiguration('deployxa').get<string>('organizationId');
        data.organization = organizations.find(item => item.id === organizationId) || organizations[0];
        data.projects = projects;
        const repository = await readRepository();
        if (repository) {
          const linkedId = vscode.workspace.getConfiguration('deployxa').get<string>('projectId');
          const normalized = (value: string) => value.replace(/\.git$/, '').toLowerCase();
          const project = data.projects.find(item => item.id === linkedId) || data.projects.find(item => normalized(item.repositoryUrl) === normalized(repository.remoteUrl));
          data.workspace = { remoteUrl: repository.remoteUrl, branch: repository.branch, project, linked: Boolean(project && project.id === linkedId) };
        }
        const groups = await Promise.all(data.projects.slice(0, 10).map(async project => (await this.clients.client().deployments.list(project.id).catch(() => [])).slice(0, 5).map(deployment => ({ ...deployment, projectName: project.name }))));
        data.deployments = groups.flat().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 10);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        data.deploymentsToday = groups.flat().filter(item => Date.parse(item.createdAt) >= today.getTime()).length;
        const monitoredProject = data.workspace?.project || data.projects[0];
        if (monitoredProject) {
          const summary = await this.clients.client().monitoring.summary(monitoredProject.id).catch(() => undefined);
          if (summary) { data.monitoring = [summary]; data.monitoringProject = monitoredProject.name; }
        }
      }
      this.lastData = data;
      this.view.webview.html = this.html(data);
    } catch (error) {
      this.lastData = { signedIn: true, projects: [], deployments: [], monitoring: [], mode: this.mode, progress: this.progress, error: error instanceof Error ? error.message : String(error) };
      this.view.webview.html = this.html(this.lastData);
    } finally { this.loading = false; }
  }

  showDeploymentProgress(project: ProjectDto, deployment: DeploymentDto, update?: RichDeploymentProgressDto) {
    this.progress = { project, deployment, update };
    void this.refresh();
  }

  clearDeploymentProgress() { this.progress = undefined; void this.refresh(); }

  private html(data: HomeData) {
    const command = (name: string, ...args: unknown[]) => escapeHtml(JSON.stringify({ command: name, args }));
    const projectCards = data.projects.map(project => {
      const status = friendlyStatus(project.status);
      return `<article class="card project-card"><div class="row"><div><h3>${escapeHtml(project.name)}</h3><p class="muted">${escapeHtml(project.framework || 'Application')} · ${escapeHtml(project.branch || 'default branch')}</p></div><span class="status ${status.kind}">${status.label}</span></div><p class="muted truncate">${escapeHtml(isUploadRepository(project.repositoryUrl) ? 'Uploaded folder' : (project.repositoryUrl || 'Repository not connected'))}</p><div class="actions"><button class="primary" data-action="${command('deployxa.deploy', project.id)}">Deploy</button><button data-action="${command('deployxa.openProjectView', project.id)}">View project</button></div></article>`;
    }).join('');
    const recent = data.deployments.map(deployment => `<button class="activity" data-action="${command('deployxa.openDeployment', deployment.id)}"><span class="dot ${friendlyStatus(deployment.status).kind}">${friendlyStatus(deployment.status).icon}</span><span><strong>${escapeHtml(deployment.projectName || 'Deployment')}</strong><small>${escapeHtml(friendlyStatus(deployment.status).label)} · ${escapeHtml(relativeDate(deployment.createdAt))}</small></span></button>`).join('');
    const progress = data.progress ? this.progressHtml(data.progress, command) : '';
    if (!data.signedIn) return this.shell(`<section class="welcome acquisition"><div class="logo">☁</div><p class="eyebrow">FROM CODE TO LIVE APP</p><h1>Put your app online from VS Code</h1><p>Connect GitHub, choose a repository, and Deployxa builds and publishes it for you. No terminal or cloud setup required.</p><button class="primary large" data-action="${command('deployxa.createAccount')}">Create Free Account</button><button class="link" data-action="${command('deployxa.signIn')}">Already use Deployxa? Sign in</button><div class="trust"><span>✓ Free to start</span><span>✓ GitHub connected</span><span>✓ Live deployment progress</span></div><button class="privacy link" data-action="${command('deployxa.configureFunnelAnalytics')}">Privacy & optional usage analytics</button></section>`, data.mode, command);
    const workspace = data.workspace ? `<section class="workspace card"><p class="eyebrow">CURRENT FOLDER</p><h2>${data.workspace.project ? `Connected to ${escapeHtml(data.workspace.project.name)}` : 'Deployxa detected a project'}</h2><p class="muted">${escapeHtml(data.workspace.remoteUrl)} · ${escapeHtml(data.workspace.branch)}</p><div class="actions">${data.workspace.project ? `<button class="primary" data-action="${command('deployxa.deploy', data.workspace.project.id)}">Deploy</button>` : ''}<button data-action="${command('deployxa.linkWorkspace')}">${data.workspace.linked ? 'Change project' : 'Link to Deployxa'}</button></div></section>` : '';
    const summary = data.monitoring[0];
    const monitoringBody = summary?.telemetryAvailable
      ? `<div class="metrics"><div><span>CPU</span><strong>${summary.cpuPercent}%</strong></div><div><span>RAM</span><strong>${summary.memoryPercent}%</strong></div><div><span>Health</span><strong>${escapeHtml(summary.containerHealth || 'Unknown')}</strong></div><div><span>Deployments today</span><strong>${data.deploymentsToday ?? 0}</strong></div></div>`
      : `<p class="muted">Monitoring unavailable. Live runtime telemetry has not been reported.</p>`;
    const monitoring = `<section class="mini-dashboard card"><div class="section-heading"><div><p class="eyebrow">MONITORING</p><h2>${escapeHtml(data.monitoringProject || 'Application overview')}</h2></div><button class="link" data-action="${data.projects[0] ? command('deployxa.openProjectView', data.projects[0].id) : command('deployxa.openDashboard')}">View details</button></div>${monitoringBody}</section>`;
    return this.shell(`<header class="hero"><div><p class="eyebrow">DEPLOYXA</p><h1>Good ${partOfDay()}${data.account?.name ? `, ${escapeHtml(firstName(data.account.name))}` : ''}</h1>${data.mode === 'advanced' ? `<p class="muted">Organization · <button class="inline-link" data-action="${command('deployxa.selectOrganization')}">${escapeHtml(data.organization?.name || 'Select organization')}</button></p>` : '<p class="muted">Choose your code and put it online.</p>'}</div><button class="icon-button" title="Refresh" aria-label="Refresh" data-action="${command('deployxa.refresh')}">↻</button></header>${progress}${workspace}<div class="section-heading"><h2>${data.projects.length ? 'Your applications' : 'Deploy your first application'}</h2><button class="primary" data-action="${command('deployxa.deploy')}">Deploy</button></div><section class="project-list">${projectCards || `<div class="empty card activation"><h3>Deploy your project</h3><p class="muted">Upload a folder directly — no Git or GitHub required. Or connect a repository.</p><div class="actions"><button class="primary" data-action="${command('deployxa.deployFolderUpload')}">Upload folder</button><button data-action="${command('deployxa.connectGitHub')}">Connect GitHub</button><button data-action="${command('deployxa.deploy')}">Use repository URL</button></div></div>`}</section>${data.projects.length ? monitoring : ''}<section class="quick card"><h2>Quick actions</h2><div class="quick-grid compact"><button data-action="${command('deployxa.deploy')}"><span>🚀 Deploy</span></button><button data-action="${command('deployxa.deployFolderUpload')}"><span>⬆ Upload folder</span></button><button data-action="${command('deployxa.showLogs')}"><span>≡ Logs</span></button><button data-action="${command('deployxa.openSettings')}"><span>⚙ Settings</span></button></div></section><section class="section-heading"><h2>Recent activity</h2><button class="link" data-action="${command('deployxa.refresh')}">Refresh</button></section><section class="activity-list">${recent || '<p class="muted">Your first deployment will appear here.</p>'}</section>${data.mode === 'advanced' ? `<section class="advanced card"><h2>Advanced details</h2><p class="muted">Deployment IDs, raw statuses, organizations, tokens, rollback, cancellation, logs, and diagnostics.</p><div class="actions"><button data-action="${command('deployxa.manageTokens')}">Accounts and tokens</button><button data-action="${command('deployxa.openDashboard')}">Technical dashboard</button></div></section>` : ''}${data.error ? `<p class="error" role="alert">${escapeHtml(data.error)}</p>` : ''}`, data.mode, command);
  }

  private progressHtml(progress: NonNullable<HomeData['progress']>, command: (name: string, ...args: unknown[]) => string) {
    const percent = Math.max(0, Math.min(100, progress.update?.percentage ?? progress.update?.percent ?? 0));
    const stage = progress.update?.currentStage || progress.update?.stage || 'Preparing your application';
    const status = String(progress.update?.status || '').toUpperCase();
    if (['SUCCESS', 'ACTIVE'].includes(status)) return `<section class="progress card success-panel" aria-live="polite"><p class="eyebrow">DEPLOYMENT COMPLETE</p><h2>🎉 Your app is live</h2><p><strong>${escapeHtml(progress.project.name)}</strong> deployed successfully.</p>${progress.deployment.url ? `<p><a href="${escapeHtml(progress.deployment.url)}">${escapeHtml(progress.deployment.url)}</a></p>` : '<p class="muted">Your live URL is being prepared.</p>'}<div class="actions"><button class="primary" data-action="${progress.deployment.url ? command('deployxa.openUrl', progress.deployment.url) : command('deployxa.openDeployment', progress.deployment.id)}">Open app</button><button data-action="${command('deployxa.copyUrl', progress.deployment.id)}">Copy URL</button><button data-action="${command('deployxa.dismissHomeProgress')}">Done</button></div></section>`;
    if (['FAILED', 'CANCELLED'].includes(status)) return `<section class="progress card failure-panel" aria-live="polite"><p class="eyebrow">DEPLOYMENT ${status === 'FAILED' ? 'FAILED' : 'STOPPED'}</p><h2>We couldn't start your application</h2><p class="muted">Deployxa could not complete <strong>${escapeHtml(progress.project.name)}</strong>. View the details or ask Deployxa to explain the supported diagnosis.</p><div class="actions"><button class="primary" data-action="${command('deployxa.diagnoseDeployment', progress.deployment.id)}">Explain the issue</button><button data-action="${command('deployxa.showLogs', progress.deployment.id)}">View details</button><button data-action="${command('deployxa.dismissHomeProgress')}">Done</button></div></section>`;
    const completed = progress.update?.completed || [];
    const remaining = progress.update?.remaining || [];
    const steps = [...completed.map(label => ({ label, state: 'done' })), { label: stage, state: 'current' }, ...remaining.filter(label => label !== stage).map(label => ({ label, state: 'waiting' }))];
    const stepList = steps.map(item => `<li class="deployment-step ${item.state}"><span>${item.state === 'done' ? '✓' : item.state === 'current' ? '●' : '○'}</span><strong>${escapeHtml(friendlyStage(item.label))}</strong><small>${item.state === 'done' ? 'Complete' : item.state === 'current' ? 'In progress' : 'Waiting'}</small></li>`).join('');
    return `<section class="progress card" aria-live="polite"><div class="row"><div><p class="eyebrow">DEPLOYING</p><h2>${escapeHtml(progress.project.name)}</h2><p class="muted">Production · ${escapeHtml(progress.project.branch)}</p></div><strong class="percent">${percent}%</strong></div><div class="bar"><span style="width:${percent}%"></span></div><ol class="deployment-steps">${stepList}</ol><div class="actions"><button data-action="${command('deployxa.showLogs', progress.deployment.id)}">View details</button><button data-action="${command('deployxa.cancelDeployment', progress.deployment.id)}">Cancel deployment</button></div></section>`;
  }

  private shell(content: string, mode: 'simple' | 'advanced', command: (name: string, ...args: unknown[]) => string) {
    const nonce = 'deployxa-home';
    return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'"><meta name="color-scheme" content="light dark"><style>${styles}</style></head><body><main>${content}</main><footer><span>Deployxa</span><button class="mode" data-mode="${mode === 'simple' ? 'advanced' : 'simple'}">${mode === 'simple' ? 'Advanced mode' : 'Simple mode'}</button></footer><script nonce="${nonce}">const vscode=acquireVsCodeApi();document.addEventListener('click',event=>{const target=event.target.closest('[data-action]');if(target){event.preventDefault();const action=JSON.parse(target.dataset.action);vscode.postMessage({type:'command',command:action.command,args:action.args||[]});return}const mode=event.target.closest('[data-mode]')?.dataset.mode;if(mode)vscode.postMessage({type:'mode',mode});});</script></body></html>`;
  }
}

function friendlyStatus(status: string) { const value = status.toUpperCase(); if (['SUCCESS', 'ACTIVE', 'RUNNING'].includes(value)) return { label: 'Running', kind: 'success', icon: '✓' }; if (['FAILED', 'ERROR'].includes(value)) return { label: 'Needs attention', kind: 'error', icon: '!' }; if (['CANCELLED', 'ROLLED_BACK'].includes(value)) return { label: 'Stopped', kind: 'muted', icon: '–' }; return { label: 'In progress', kind: 'working', icon: '•' }; }
function friendlyStage(stage: string) { return stage.replace(/[_-]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase()); }
function relativeDate(value: string) { const timestamp = Date.parse(value); if (!Number.isFinite(timestamp)) return 'recently'; const minutes = Math.max(1, Math.round((Date.now() - timestamp) / 60000)); return minutes < 60 ? `${minutes} min ago` : `${Math.round(minutes / 60)} hr ago`; }
function partOfDay() { const hour = new Date().getHours(); return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'; }
function firstName(name: string) { return name.trim().split(/\s+/)[0] || name; }
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character)); }
const styles = `:root{color-scheme:light dark}*{box-sizing:border-box}body{font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);color:var(--vscode-foreground);background:var(--vscode-sideBar-background);margin:0}main{max-width:920px;margin:0 auto;padding:22px 24px 72px}.hero,.row,.section-heading,.actions{display:flex;align-items:center;justify-content:space-between;gap:12px}.hero{margin-bottom:20px}.eyebrow{font-size:11px;letter-spacing:.12em;color:var(--vscode-textLink-foreground);font-weight:700;margin:0 0 6px}h1{font-size:26px;margin:0 0 4px}h2{font-size:18px;margin:0 0 12px}h3{font-size:15px;margin:0 0 5px}p{line-height:1.45;margin:7px 0}.muted{color:var(--vscode-descriptionForeground)}.card{border:1px solid var(--vscode-widget-border);background:var(--vscode-editor-background);border-radius:8px;padding:16px;margin-bottom:18px}.project-list{display:flex;flex-direction:column;gap:8px;margin-bottom:20px}.project-list .card{margin:0}.project-card{min-height:auto}.status{border-radius:999px;padding:3px 9px;font-size:11px;white-space:nowrap}.status.success{color:var(--vscode-testing-iconPassed);background:color-mix(in srgb,var(--vscode-testing-iconPassed) 15%,transparent)}.status.error{color:var(--vscode-errorForeground);background:color-mix(in srgb,var(--vscode-errorForeground) 15%,transparent)}.status.working{color:var(--vscode-textLink-foreground);background:color-mix(in srgb,var(--vscode-textLink-foreground) 15%,transparent)}.status.muted{color:var(--vscode-descriptionForeground);background:var(--vscode-badge-background)}.truncate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.actions{justify-content:flex-start;margin-top:14px;flex-wrap:wrap}button{font:inherit;color:var(--vscode-button-foreground);background:var(--vscode-button-background);border:1px solid transparent;border-radius:4px;padding:6px 11px;cursor:pointer}button:hover{background:var(--vscode-button-hoverBackground)}button:focus-visible{outline:2px solid var(--vscode-focusBorder);outline-offset:2px}.primary{font-weight:600}.large{padding:10px 24px;font-size:15px}.link,.mode,.inline-link{background:transparent;color:var(--vscode-textLink-foreground);border:0;padding:6px}.inline-link{padding:0}.icon-button{font-size:20px;background:transparent;color:var(--vscode-foreground);border:0}.welcome{text-align:center;padding:48px 18px}.welcome .logo{font-size:46px;color:var(--vscode-textLink-foreground);margin-bottom:10px}.welcome p{max-width:360px;margin:0 auto 22px}.welcome .link{display:block;margin:12px auto}.quick-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.quick-grid button{display:flex;flex-direction:column;align-items:flex-start;gap:4px;text-align:left;background:var(--vscode-textCodeBlock-background);border-color:var(--vscode-widget-border)}.quick-grid span{font-weight:600}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.metrics div{padding:10px;border-radius:5px;background:var(--vscode-textCodeBlock-background);display:flex;flex-direction:column;gap:5px}.metrics span{color:var(--vscode-descriptionForeground);font-size:11px}.metrics strong{font-size:18px}.activity-list{display:flex;flex-direction:column;gap:2px;margin-bottom:20px}.activity{display:flex;align-items:center;justify-content:flex-start;gap:10px;text-align:left;background:transparent;border:0;border-radius:4px;width:100%}.activity:hover{background:var(--vscode-list-hoverBackground)}.activity small{display:block;color:var(--vscode-descriptionForeground);margin-top:3px}.dot{width:22px;height:22px;border-radius:50%;display:inline-grid;place-items:center;background:var(--vscode-badge-background)}.dot.success{color:var(--vscode-testing-iconPassed)}.dot.error{color:var(--vscode-errorForeground)}.progress{border-color:var(--vscode-textLink-foreground)}.percent{font-size:24px;color:var(--vscode-textLink-foreground)}.bar{height:8px;border-radius:8px;background:var(--vscode-progressBar-background);overflow:hidden;margin:16px 0 10px}.bar span{height:100%;display:block;background:var(--vscode-textLink-foreground);transition:width .2s ease}.deployment-steps{list-style:none;padding:0;margin:14px 0}.deployment-step{display:grid;grid-template-columns:22px 1fr auto;gap:8px;padding:7px 0;color:var(--vscode-descriptionForeground)}.deployment-step.done{color:var(--vscode-testing-iconPassed)}.deployment-step.current{color:var(--vscode-foreground)}.deployment-step small{color:inherit}.error{color:var(--vscode-errorForeground)}footer{position:fixed;bottom:0;left:0;right:0;display:flex;justify-content:space-between;padding:8px 16px;background:var(--vscode-editor-background);border-top:1px solid var(--vscode-widget-border);color:var(--vscode-descriptionForeground)}@media(max-width:600px){main{padding:16px}.quick-grid,.metrics{grid-template-columns:repeat(2,1fr)}}@media(prefers-reduced-motion:reduce){.bar span{transition:none}}`;
