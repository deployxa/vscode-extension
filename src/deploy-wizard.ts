import * as vscode from 'vscode';
import type { DeployxaClient, ProjectDto, ReadinessDto } from '@deployxa/sdk';
import type { FunnelTracker } from './funnel.js';

export class DeployxaDeployWizard {
  private static current?: DeployxaDeployWizard;
  private readonly panel: vscode.WebviewPanel;
  private constructor(private readonly clients: DeployxaClient, private readonly extensionUri: vscode.Uri, private initial?: ProjectDto, private readonly funnel?: FunnelTracker) {
    this.panel = vscode.window.createWebviewPanel('deployxa.deployWizard', 'Deployxa · Deploy', vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: false });
    this.panel.onDidDispose(() => { if (DeployxaDeployWizard.current === this) DeployxaDeployWizard.current = undefined; });
    this.panel.webview.onDidReceiveMessage(async message => {
      if (message.type === 'cancel') this.panel.dispose();
      if (message.type === 'current') void vscode.commands.executeCommand('deployxa.deployCurrentWorkspace');
      if (message.type === 'folder') void vscode.commands.executeCommand('deployxa.deployFolder');
      if (message.type === 'create' && message.name && message.repositoryUrl) void this.create(message);
      if (message.type === 'select' && typeof message.projectId === 'string') {
        try { this.initial = await this.clients.projects.get(message.projectId); await this.refresh(); }
        catch (error) { await this.showError(error); }
      }
      if (message.type === 'deploy' && typeof message.projectId === 'string' && message.projectId) {
        try {
          await vscode.commands.executeCommand('deployxa.deployConfirmed', message.projectId);
          this.panel.dispose();
          await vscode.commands.executeCommand('workbench.view.extension.deployxa');
          await vscode.commands.executeCommand('deployxa.home.focus');
        } catch (error) { await this.showError(error); }
      }
    });
    void this.refresh();
  }
  static show(clients: DeployxaClient, extensionUri: vscode.Uri, project?: ProjectDto, funnel?: FunnelTracker) { DeployxaDeployWizard.current?.panel.dispose(); DeployxaDeployWizard.current = new DeployxaDeployWizard(clients, extensionUri, project, funnel); }
  private async create(message: { name: string; repositoryUrl: string; branch?: string }) {
    try {
      this.initial = await this.clients.projects.create({ name: message.name.trim(), repositoryUrl: message.repositoryUrl.trim(), branch: message.branch?.trim() || 'main' });
      await this.funnel?.record('project_created');
      await this.refresh();
    } catch (error) { await this.showError(error); }
  }
  private async showError(error: unknown) { await this.panel.webview.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) }); }
  private async refresh() {
    try {
      const projects = await this.clients.projects.list();
      const selected = this.initial || projects[0];
      const readiness = selected ? await this.clients.readiness.get(selected.id).catch(() => undefined) : undefined;
      this.panel.webview.html = this.html(projects, selected, readiness);
    } catch (error) { this.panel.webview.html = `<main><h1>Deployxa</h1><p>${escapeHtml(error instanceof Error ? error.message : String(error))}</p></main>`; }
  }
  private html(projects: ProjectDto[], selected?: ProjectDto, readiness?: ReadinessDto) {
    const options = projects.map(project => `<option value="${escapeHtml(project.id)}" ${project.id === selected?.id ? 'selected' : ''}>${escapeHtml(project.name)}</option>`).join('');
    const checks = readiness?.checks?.map(check => `<li>${check.passed ? '✓' : '!'} ${escapeHtml(check.label)}</li>`).join('') || '<li>Readiness details unavailable</li>';
    const nonce = `${Date.now()}${Math.random().toString(36).slice(2)}`;
    return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'"><meta name="color-scheme" content="light dark"><style>body{font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);color:var(--vscode-foreground);background:var(--vscode-editor-background);margin:0}.shell{max-width:820px;margin:auto;padding:32px}.steps{display:flex;gap:8px;margin:20px 0}.step{flex:1;padding:9px;border-bottom:2px solid var(--vscode-widget-border);color:var(--vscode-descriptionForeground)}.step.active{border-color:var(--vscode-textLink-foreground);color:var(--vscode-foreground)}.card{border:1px solid var(--vscode-widget-border);background:var(--vscode-sideBar-background);border-radius:9px;padding:20px;margin:16px 0}select,input,button{font:inherit;padding:9px 12px;border-radius:4px;border:1px solid var(--vscode-widget-border)}select,input{width:100%;margin:6px 0 12px;background:var(--vscode-input-background);color:var(--vscode-input-foreground)}button{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);cursor:pointer}button:hover{background:var(--vscode-button-secondaryHoverBackground)}button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid var(--vscode-focusBorder);outline-offset:2px}.primary{background:var(--vscode-button-background);color:var(--vscode-button-foreground);font-weight:700}.primary:hover{background:var(--vscode-button-hoverBackground)}.primary[disabled]{opacity:.5;cursor:not-allowed}.source-actions{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0 20px}.actions{display:flex;gap:10px;justify-content:flex-end;position:sticky;bottom:0;background:var(--vscode-editor-background);padding:16px 0}.check{display:grid;grid-template-columns:24px 1fr;gap:8px;padding:8px 0}.muted{color:var(--vscode-descriptionForeground)}.error{display:none;color:var(--vscode-errorForeground);border:1px solid var(--vscode-inputValidation-errorBorder);background:var(--vscode-inputValidation-errorBackground);padding:10px;border-radius:5px}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.summary div{background:var(--vscode-textCodeBlock-background);padding:12px;border-radius:5px}.summary small{display:block;color:var(--vscode-descriptionForeground);margin-bottom:5px}@media(max-width:600px){.shell{padding:18px}.steps{display:none}.summary{grid-template-columns:1fr}}</style></head><body><main class="shell"><p class="muted">DEPLOYXA · VISUAL DEPLOYMENT</p><h1>Put your application online</h1><p class="muted">Choose your project, review what Deployxa detected, then deploy.</p><div class="steps" aria-label="Deployment steps"><div class="step active">1 Project</div><div class="step active">2 Review</div><div class="step">3 Deploy</div></div><p id="error" class="error" role="alert"></p><section class="card"><h2>What would you like to deploy?</h2><p class="muted">Choose an existing project, your open project, or a folder on your device.</p><div class="source-actions"><button id="current" ${vscode.workspace.workspaceFolders?.length ? "" : "disabled"}>Current open project</button><button id="folder">Choose a folder from this device</button></div><h2>Choose an existing project</h2><label for="project">Project</label><select id="project">${options || '<option value="">No projects available</option>'}</select>${selected ? `<div class="summary"><div><small>Framework</small><strong>${escapeHtml(selected.framework || 'Automatic')}</strong></div><div><small>Branch</small><strong>${escapeHtml(selected.branch || 'main')}</strong></div><div><small>Environment</small><strong>Production</strong></div></div><p class="muted">${escapeHtml(selected.repositoryUrl || 'Repository not connected')}</p>` : '<p>No project is available yet. Import a Git repository below.</p>'}</section>${selected ? '' : `<section class="card"><h2>Import Git repository</h2><p class="muted">Create a Deployxa project without leaving VS Code.</p><label>Project name<input id="name" placeholder="My application" required></label><label>Repository URL<input id="repository" placeholder="https://github.com/you/project" required></label><label>Branch<input id="branch" value="main"></label><button id="create">Create project</button></section>`}<section class="card"><h2>Deployment readiness</h2><ul>${readiness?.checks?.map(check => `<li class="check"><span>${check.passed ? '✓' : '!'}</span><span>${escapeHtml(check.label)}</span></li>`).join('') || '<li class="muted">Readiness details are not available. Deployxa will still validate the project.</li>'}</ul>${readiness ? `<p><strong>${readiness.score}% ready</strong> · ${escapeHtml(readiness.status)}</p>` : ''}</section><div class="actions"><button id="cancel">Cancel</button><button class="primary" id="deploy" ${selected ? '' : 'disabled'}>Deploy now</button></div></main><script nonce="${nonce}">const vscode=acquireVsCodeApi();const project=document.getElementById('project');const deploy=document.getElementById('deploy');document.getElementById('cancel').onclick=()=>vscode.postMessage({type:'cancel'});document.getElementById('current')?.addEventListener('click',()=>vscode.postMessage({type:'current'}));document.getElementById('folder')?.addEventListener('click',()=>vscode.postMessage({type:'folder'}));project.onchange=()=>{deploy.disabled=true;deploy.textContent='Loading…';vscode.postMessage({type:'select',projectId:project.value})};deploy.onclick=()=>{deploy.disabled=true;deploy.textContent='Starting deployment…';vscode.postMessage({type:'deploy',projectId:project.value})};const create=document.getElementById('create');if(create)create.onclick=()=>{create.disabled=true;create.textContent='Creating project…';vscode.postMessage({type:'create',name:document.getElementById('name').value,repositoryUrl:document.getElementById('repository').value,branch:document.getElementById('branch').value})};window.addEventListener('message',event=>{if(event.data?.type==='error'){const error=document.getElementById('error');error.textContent=event.data.message;error.style.display='block';deploy.disabled=false;deploy.textContent='Deploy now';if(create){create.disabled=false;create.textContent='Create project'}}});</script></body></html>`;
  }
}
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c] || c)); }
