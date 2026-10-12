import * as vscode from 'vscode';
import { basename } from 'node:path';
import type { DeploymentDto, ProjectDto } from '@deployxa/sdk';
import { DeployxaError, isUploadRepository } from '@deployxa/sdk';
import { ClientManager } from './client.js';
import { dashboardDeploymentUrl, dashboardProjectUrl, deploymentLogText, type DeploymentNode, type ProjectNode } from './model.js';
import { DeployxaTreeProvider } from './tree.js';
import { DeployxaDashboard } from './dashboard.js';
import { DeployxaHome } from './home.js';
import { DeployxaProjectPanel } from './project.js';
import { readRepository } from './local.js';
import { DeployxaDeployWizard } from './deploy-wizard.js';
import { FunnelTracker } from './funnel.js';
import { archiveFolder, estimateFolderSize, isTarAvailable, UPLOAD_LIMIT, uploadLimitMessage, tarMissingMessage } from './upload.js';

const message = (error: unknown) => error instanceof DeployxaError ? error.message : error instanceof Error ? error.message : String(error);
const dashboardUrl = () => vscode.workspace.getConfiguration('deployxa').get<string>('dashboardUrl') || 'https://deployxa.com/dashboard';

export function activate(context: vscode.ExtensionContext) {
  const clients = new ClientManager(context);
  const funnel = new FunnelTracker(context, () => clients.installationId(), input => clients.client().analytics.trackExtensionEvent(input));
  void funnel.record('extension_activated');
  const tree = new DeployxaTreeProvider(clients);
  const home = new DeployxaHome(clients, context, funnel);
  const dashboard = new DeployxaDashboard(context.extensionUri, async () => {
    const projects = await clients.client().projects.list();
    const deploymentGroups = await Promise.all(projects.map(project => clients.client().deployments.list(project.id)));
    const monitoring = await Promise.all(projects.slice(0, 10).map(async project => ({
      project,
      summary: await clients.client().monitoring.summary(project.id).catch(() => undefined),
    })));
    return { projects, deployments: deploymentGroups.flat(), monitoring };
  });
  const output = vscode.window.createOutputChannel('Deployxa', { log: true });
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 20);
  status.command = 'deployxa.signIn'; status.text = '$(cloud) Deployxa: Sign in'; status.tooltip = 'Sign in to Deployxa'; status.show();
  context.subscriptions.push(output, status, vscode.window.registerWebviewViewProvider('deployxa.home', home), vscode.window.registerTreeDataProvider('deployxa.projects', tree), vscode.window.registerWebviewViewProvider('deployxa.dashboard', dashboard));
  context.subscriptions.push(vscode.commands.registerCommand('deployxa.home.focus', async () => {
    await vscode.commands.executeCommand('workbench.view.extension.deployxa');
    await vscode.commands.executeCommand('workbench.action.focusView', 'deployxa.home');
  }));
  context.subscriptions.push(vscode.window.registerUriHandler({ handleUri: async uri => {
    await runCallback(uri).catch(error => { output.error(`Browser callback: ${message(error)}`); void vscode.window.showErrorMessage(`Deployxa: ${message(error)}`); });
  }}));

  const runCallback = async (uri: vscode.Uri) => {
    const github = uri.path === '/github/callback';
    await clients.handleExtensionCallback(uri);
    if (github) {
      await funnel.record('github_connection_completed');
      const repositories = await clients.client().repositories.list();
      const choice = await vscode.window.showQuickPick(repositories.map(repository => ({ label: repository.fullName, description: repository.private ? 'Private' : 'Public', detail: repository.cloneUrl, repository })), { placeHolder: 'Choose a repository to deploy' });
      if (choice) await vscode.commands.executeCommand('deployxa.deployRepository', choice.repository);
      void home.refresh(); return;
    }
    await funnel.record('registration_completed');
    await funnel.record('extension_authenticated');
    status.command = 'deployxa.refresh'; status.text = '$(cloud) Deployxa';
    tree.refresh(); void home.refresh();
    void vscode.window.showInformationMessage('Welcome to Deployxa. Your account is connected.', 'Connect GitHub').then(selection => { if (selection) void vscode.commands.executeCommand('deployxa.connectGitHub'); });
  };

  void clients.token().then(token => {
    if (token) {
      status.command = 'deployxa.refresh'; status.text = '$(cloud) Deployxa'; status.tooltip = 'Refresh Deployxa projects';
      void tree.refresh(); void home.refresh();
      return;
    }
    const welcomeKey = 'deployxa.welcomeShown';
    if (!context.globalState.get<boolean>(welcomeKey)) {
      void context.globalState.update(welcomeKey, true);
      void vscode.window.showInformationMessage('Welcome to Deployxa. Sign in with an API token to view and deploy your projects.', 'Sign in', 'How to get a token').then(selection => {
        if (selection === 'Sign in') void vscode.commands.executeCommand('deployxa.signIn');
        if (selection === 'How to get a token') void vscode.env.openExternal(vscode.Uri.parse('https://deployxa.com/dashboard'));
      });
    }
  });

  const run = async (label: string, operation: () => Promise<void>) => {
    try { status.text = `$(sync~spin) Deployxa: ${label}`; await operation(); }
    catch (error) { output.error(`${label}: ${message(error)}`); void vscode.window.showErrorMessage(`Deployxa: ${message(error)}`); }
    finally { status.text = '$(cloud) Deployxa'; }
  };
  const selectProject = async (): Promise<ProjectDto | undefined> => {
    const projects = await clients.client().projects.list();
    const choice = await vscode.window.showQuickPick(projects.map(project => ({ label: project.name, description: project.framework, detail: project.repositoryUrl, project })), { placeHolder: 'Select a Deployxa project' });
    return choice?.project;
  };
  const deployFromFolder = async (folder: string) => {
    const repository = await readRepository(folder);
    if (!repository) {
      // No git remote: offer to deploy by uploading the folder directly.
      // This is the path vibe coders (AI-generated folders, no GitHub) need.
      const choice = await vscode.window.showInformationMessage(
        'This folder has no Git remote. Deployxa can upload and deploy it directly — no GitHub required.',
        { modal: true }, 'Upload folder directly', 'Cancel');
      if (choice === 'Upload folder directly') await deployByUpload(folder);
      return;
    }
    const projects = await clients.client().projects.list();
    let project = projects.find(item => item.repositoryUrl.replace(/\.git$/, '') === repository.remoteUrl.replace(/\.git$/, ''));
    if (!project) {
      const name = await vscode.window.showInputBox({ title: 'Name your new Deployxa project', value: folder.split('/').pop() || 'My project', prompt: 'This creates a project from the selected repository.' });
      if (!name) return;
      project = await clients.client().projects.create({ name: name.trim(), repositoryUrl: repository.remoteUrl, branch: repository.branch });
      await funnel.record('project_created');
    }
    if (vscode.workspace.workspaceFolders?.length) await vscode.workspace.getConfiguration('deployxa').update('projectId', project.id, vscode.ConfigurationTarget.Workspace);
    await funnel.record('workspace_linked');
    DeployxaDeployWizard.show(clients.client(), context.extensionUri, project, funnel);
  };
  const streamDeploymentTo = (project: ProjectDto, deployment: DeploymentDto) =>
    void vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `Deploying ${project.name}`, cancellable: false }, async progress => {
      let terminalStatus = false; let previousPercent = 0;
      try {
        for await (const update of clients.client().streamDeploymentProgress(deployment.id, { intervalMs: 2000 })) {
          const deploymentStatus = String(update.status);
          home.showDeploymentProgress(project, deployment, update);
          progress.report({ message: `${update.stage} (${update.percent}%)`, increment: Math.max(0, update.percent - previousPercent) });
          previousPercent = update.percent;
          status.text = `$(sync~spin) Deployxa: ${update.stage} ${update.percent}%`;
          if (['SUCCESS', 'ACTIVE', 'FAILED', 'CANCELLED'].includes(deploymentStatus)) {
            terminalStatus = true; tree.refresh();
            if (['SUCCESS', 'ACTIVE'].includes(deploymentStatus)) {
              await funnel.record('first_deployment_succeeded');
              status.text = '$(pass-filled) Deployxa: Healthy';
              void vscode.window.showInformationMessage('Deployxa · Deployment Successful', { detail: `${project.name} · ${deployment.isPreview ? 'Preview' : 'Production'}` }, 'Open', 'Copy URL', 'Logs').then(selection => {
                if (selection === 'Open') void vscode.env.openExternal(vscode.Uri.parse(deployment.url || dashboardDeploymentUrl(dashboardUrl(), deployment.id)));
                if (selection === 'Copy URL' && deployment.url) void vscode.env.clipboard.writeText(deployment.url);
                if (selection === 'Logs') void vscode.commands.executeCommand('deployxa.showLogs', deployment.id);
              });
            } else {
              status.text = '$(error) Deployxa: Deployment failed';
              void vscode.window.showErrorMessage(`Deployxa · Deployment ${deploymentStatus.toLowerCase()}`, { detail: `${project.name} · ${deployment.isPreview ? 'Preview' : 'Production'}` }, 'Explain issue', 'View Logs').then(selection => {
                if (selection === 'Explain issue') void vscode.commands.executeCommand('deployxa.diagnoseDeployment', deployment.id);
                if (selection === 'View Logs') void vscode.commands.executeCommand('deployxa.showLogs', deployment.id);
              });
            }
            if (deploymentStatus === 'FAILED') await funnel.record('first_deployment_failed');
            break;
          }
        }
      } catch (error) {
        output.error(`Deployment ${deployment.id}: ${message(error)}`);
        status.text = '$(error) Deployxa: Deployment error';
        void vscode.window.showErrorMessage(`Deployment failed: ${message(error)}`, 'View Logs').then(selection => {
          if (selection) void vscode.commands.executeCommand('deployxa.showLogs', { kind: 'deployment', deployment, project });
        });
      } finally {
        if (!terminalStatus) tree.refresh();
        setTimeout(() => { status.text = '$(cloud) Deployxa'; }, 5000);
      }
    });
  // Upload a folder to an existing project (re-deploy) or a brand-new one. The
  // Engine build worker extracts the archive instead of git-cloning, so
  // upload-backed projects never need a remote.
  const uploadDeployment = async (folder: string, existing?: ProjectDto) => {
    if (!isTarAvailable()) { void vscode.window.showErrorMessage(tarMissingMessage); return; }
    const size = estimateFolderSize(folder);
    if (size > UPLOAD_LIMIT) { void vscode.window.showWarningMessage(uploadLimitMessage); return; }
    const sizeLabel = size > 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${Math.round(size / 1024)} KB`;
    const name = existing?.name ?? await vscode.window.showInputBox({
      title: 'Name your Deployxa project', value: basename(folder) || 'My project',
      prompt: `Deployxa will package this folder (${sizeLabel}) and build it for you. No Git or GitHub required.`,
      ignoreFocusOut: true,
    });
    if (!name) return;
    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `Uploading ${name}`, cancellable: true }, async (progress, token) => {
      const archive = archiveFolder(folder);
      const filename = `${name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'project'}.tar.gz`;
      let uploaded = 0;
      const total = archive.estimatedSize || size;
      const controller = new AbortController();
      token.onCancellationRequested(() => { archive.cleanup(); controller.abort(); });
      const body = new ReadableStream<Uint8Array>({
        start: streamController => {
          archive.stream.on('data', chunk => {
            streamController.enqueue(new Uint8Array(chunk));
            uploaded += chunk.length;
            if (total) progress.report({ message: `${(uploaded / 1024 / 1024).toFixed(1)} / ${(total / 1024 / 1024).toFixed(1)} MB`, increment: (chunk.length / total) * 100 });
          });
          archive.stream.on('end', () => streamController.close());
          archive.stream.on('error', error => { streamController.error(error); archive.cleanup(); });
        },
        cancel: () => archive.cleanup(),
      });
      try {
        let project: ProjectDto; let deployment: DeploymentDto;
        if (existing) {
          project = existing;
          deployment = await clients.client().deployments.upload(project.id, body, filename, { signal: controller.signal });
        } else {
          ({ project, deployment } = await clients.client().uploadProject({ name: name.trim(), archive: body, filename }, { signal: controller.signal }));
          if (vscode.workspace.workspaceFolders?.length) await vscode.workspace.getConfiguration('deployxa').update('projectId', project.id, vscode.ConfigurationTarget.Workspace);
          await funnel.record('project_created');
        }
        await funnel.record('upload_deployment_started');
        tree.refresh(); home.showDeploymentProgress(project, deployment);
        await funnel.record('first_deployment_started');
        void funnel.record('upload_deployment_succeeded');
        streamDeploymentTo(project, deployment);
      } catch (error) {
        if (controller.signal.aborted) { output.error(`Upload cancelled: ${name}`); return; }
        output.error(`Upload failed: ${message(error)}`);
        void funnel.record('upload_deployment_failed');
        void vscode.window.showErrorMessage(`Deployxa: ${message(error)}`);
      }
    });
  };
  const deployByUpload = (folder: string) => uploadDeployment(folder);
  const redeployByUpload = (project: ProjectDto, folder: string) => uploadDeployment(folder, project);
  const projectFrom = async (node?: ProjectNode | string) => typeof node === 'string' ? clients.client().projects.get(node) : node?.kind === 'project' ? node.project : selectProject();
  const deploymentFrom = async (node?: DeploymentNode | string): Promise<DeploymentDto | undefined> => {
    if (typeof node === 'string') return clients.client().deployments.get(node);
    if (node?.kind === 'deployment') return node.deployment;
    const project = await selectProject(); if (!project) return;
    const deployments = await clients.client().deployments.list(project.id);
    const choice = await vscode.window.showQuickPick(deployments.map(deployment => ({ label: deployment.id, description: deployment.status, detail: deployment.url || deployment.branch || '', deployment })), { placeHolder: 'Select a deployment' });
    return choice?.deployment;
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('deployxa.createAccount', () => run('Opening registration', async () => {
      await funnel.record('registration_clicked');
      const flow = await clients.beginExtensionAuth();
      await vscode.env.openExternal(vscode.Uri.parse(flow.authorizationUrl));
      void vscode.window.showInformationMessage('Finish creating your free account in the browser. Deployxa will return you securely to VS Code.');
    })),
    vscode.commands.registerCommand('deployxa.configureFunnelAnalytics', async () => {
      const choice = await vscode.window.showInformationMessage('Help improve the path from extension install to first deployment? Events are currently stored only in VS Code and are never sent without an approved analytics transport.', { modal: true }, 'Allow', 'Do not allow');
      if (choice === 'Allow') await funnel.setConsent(true);
      if (choice === 'Do not allow') await funnel.setConsent(false);
    }),
    vscode.commands.registerCommand('deployxa.signIn', () => run('Signing in', async () => {
      const token = await vscode.window.showInputBox({ title: 'Deployxa API token', prompt: 'Paste your Deployxa API token', password: true, ignoreFocusOut: true });
      if (!token) return; const account = await clients.authenticate(token);
      tree.refresh(); void home.refresh(); status.command = 'deployxa.refresh'; status.text = '$(cloud) Deployxa'; status.tooltip = `Signed in as ${account.email}`; void vscode.window.showInformationMessage(`Signed in to Deployxa as ${account.email}.`);
    })),
    vscode.commands.registerCommand('deployxa.signOut', () => run('Signing out', async () => { await clients.clearToken(); status.command = 'deployxa.signIn'; status.text = '$(cloud) Deployxa: Sign in'; status.tooltip = 'Sign in to Deployxa'; tree.refresh(); void home.refresh(); void vscode.window.showInformationMessage('Signed out of Deployxa.'); })),
    vscode.commands.registerCommand('deployxa.switchAccount', () => run('Switching account', async () => { const choice = await vscode.window.showQuickPick(clients.accounts().map(account => ({ label: account.email, account })), { placeHolder: 'Select a Deployxa account' }); if (choice) { await clients.switchAccount(choice.account.id); tree.refresh(); void home.refresh(); status.tooltip = `Signed in as ${choice.account.email}`; } })),
    vscode.commands.registerCommand('deployxa.addAccount', () => vscode.commands.executeCommand('deployxa.signIn')),
    vscode.commands.registerCommand('deployxa.removeAccount', () => run('Removing account', async () => { const choice = await vscode.window.showQuickPick(clients.accounts().map(account => ({ label: account.email, account })), { placeHolder: 'Select an account to remove' }); if (choice) { await clients.removeAccount(choice.account.id); tree.refresh(); void home.refresh(); } })),
    vscode.commands.registerCommand('deployxa.manageTokens', () => run('Managing accounts', async () => { const choice = await vscode.window.showQuickPick(['Add account', 'Switch account', 'Remove account', 'Open token dashboard']); if (choice === 'Add account') await vscode.commands.executeCommand('deployxa.addAccount'); if (choice === 'Switch account') await vscode.commands.executeCommand('deployxa.switchAccount'); if (choice === 'Remove account') await vscode.commands.executeCommand('deployxa.removeAccount'); if (choice === 'Open token dashboard') await vscode.env.openExternal(vscode.Uri.parse(dashboardUrl())); })),
    vscode.commands.registerCommand('deployxa.refresh', () => { tree.refresh(); void home.refresh(); void dashboard.refresh(); }),
    vscode.commands.registerCommand('deployxa.openDashboard', () => vscode.env.openExternal(vscode.Uri.parse(dashboardUrl()))),
    vscode.commands.registerCommand('deployxa.openSettings', () => vscode.commands.executeCommand('workbench.action.openSettings', '@ext:deployxa.deployxa-vscode')),
    vscode.commands.registerCommand('deployxa.copyText', async (value?: string) => { if (value) { await vscode.env.clipboard.writeText(value); void vscode.window.showInformationMessage('Copied to clipboard.'); } }),
    vscode.commands.registerCommand('deployxa.verifyDomain', (projectId?: string, domain?: string) => run('Verifying domain', async () => { if (!projectId || !domain) return; await clients.client().domains.verify(projectId, domain); void home.refresh(); void vscode.window.showInformationMessage(`Deployxa · Domain verification requested`, { detail: domain }); })),
    vscode.commands.registerCommand('deployxa.checkDomainAvailability', (projectId?: string) => run('Checking domain', async () => {
      const input = await vscode.window.showInputBox({ title: 'Check Domain Availability & Pricing', prompt: 'Enter a domain to check (e.g. myapp.com or mybrand.io)', ignoreFocusOut: true });
      if (!input) return;
      const domain = input.trim().toLowerCase();
      const result = await clients.client().registrar.checkAvailability(domain);
      const priceFmt = (cents?: number, cur = 'USD') => cents ? `$${(cents / 100).toFixed(2)} ${cur}` : '';
      if (result.available) {
        const costStr = result.registrationPriceCents ? `${priceFmt(result.registrationPriceCents, result.currency)}/year` : 'Standard price';
        const renewStr = result.renewalPriceCents ? ` (renews at ${priceFmt(result.renewalPriceCents, result.currency)})` : '';
        const choice = await vscode.window.showInformationMessage(`Domain ${result.domain} is AVAILABLE! Registration: ${costStr}${renewStr}`, { modal: true }, 'Purchase & Attach', 'Search Alternatives');
        if (choice === 'Purchase & Attach') await vscode.commands.executeCommand('deployxa.purchaseDomain', projectId, result.domain, result.registrationPriceCents);
        if (choice === 'Search Alternatives') await vscode.commands.executeCommand('deployxa.suggestDomains', projectId, domain.split('.')[0]);
      } else {
        const choice = await vscode.window.showWarningMessage(`Domain ${result.domain} is already registered or unavailable.`, 'Search Available Alternatives');
        if (choice === 'Search Available Alternatives') await vscode.commands.executeCommand('deployxa.suggestDomains', projectId, domain.split('.')[0]);
      }
    })),
    vscode.commands.registerCommand('deployxa.suggestDomains', (projectId?: string, initialKeyword?: string) => run('Suggesting domains', async () => {
      const keyword = initialKeyword || await vscode.window.showInputBox({ title: 'Search Domain Suggestions', prompt: 'Enter a brand name or keyword (e.g. deployxa, mystore)', ignoreFocusOut: true });
      if (!keyword) return;
      const suggestions = await clients.client().registrar.getSuggestions(keyword.trim());
      if (!suggestions.length) { void vscode.window.showInformationMessage(`No domain suggestions found for "${keyword}".`); return; }
      const priceFmt = (cents?: number, cur = 'USD') => cents ? `$${(cents / 100).toFixed(2)} ${cur}` : '';
      const items = suggestions.map(s => ({
        label: `${s.domain} ${s.available ? '✓ AVAILABLE' : '✗ Taken'}`,
        description: s.available && s.priceCents ? `${priceFmt(s.priceCents, s.currency)}/yr` : (s.available ? 'Available' : 'Unavailable'),
        detail: s.available ? 'Click to purchase and attach to project' : 'Unavailable',
        suggestion: s,
      }));
      const picked = await vscode.window.showQuickPick(items, { placeHolder: `Domain suggestions for "${keyword}" (Select to register)` });
      if (picked && picked.suggestion.available) await vscode.commands.executeCommand('deployxa.purchaseDomain', projectId, picked.suggestion.domain, picked.suggestion.priceCents);
    })),
    vscode.commands.registerCommand('deployxa.purchaseDomain', (projectId?: string, targetDomain?: string, priceCents?: number) => run('Purchasing domain', async () => {
      const project = projectId ? await clients.client().projects.get(projectId) : await selectProject();
      if (!project) return;
      const domain = targetDomain || await vscode.window.showInputBox({ title: `Purchase domain for ${project.name}`, prompt: 'Enter domain name to purchase', ignoreFocusOut: true });
      if (!domain) return;
      let cost = priceCents;
      if (!cost) {
        const check = await clients.client().registrar.checkAvailability(domain.trim());
        if (!check.available) { void vscode.window.showErrorMessage(`Domain ${domain} is not available.`); return; }
        cost = check.registrationPriceCents;
      }
      const priceStr = cost ? `$${(cost / 100).toFixed(2)} USD` : 'your organization credits';
      const confirm = await vscode.window.showWarningMessage(`Purchase and register ${domain} for ${priceStr} using organization credits and attach to ${project.name}?`, { modal: true }, 'Confirm & Purchase');
      if (confirm !== 'Confirm & Purchase') return;
      const order = await clients.client().registrar.register({ projectId: project.id, domain: domain.trim(), durationYears: 1, privacy: true });
      void vscode.window.showInformationMessage(`Domain ${domain} registered successfully! (Order ID: ${order.orderId || 'completed'})`);
      DeployxaProjectPanel.show(clients.client(), project, context.extensionUri);
      tree.refresh(); void home.refresh();
    })),
    vscode.commands.registerCommand('deployxa.setupMcp', () => run('Configuring MCP', async () => {
      const folders = vscode.workspace.workspaceFolders;
      if (!folders?.length) { void vscode.window.showWarningMessage('Open a workspace folder in VS Code first.'); return; }
      const rootUri = folders[0].uri;
      const mcpUri = vscode.Uri.joinPath(rootUri, '.vscode', 'mcp.json');
      const rootMcpUri = vscode.Uri.joinPath(rootUri, '.mcp.json');
      const config = { mcpServers: { deployxa: { url: "https://mcp.deployxa.com/mcp" } } };
      const formatted = JSON.stringify(config, null, 2) + '\n';
      const encoder = new TextEncoder();
      await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(rootUri, '.vscode'));
      await vscode.workspace.fs.writeFile(mcpUri, encoder.encode(formatted));
      await vscode.workspace.fs.writeFile(rootMcpUri, encoder.encode(formatted));
      const choice = await vscode.window.showInformationMessage('Deployxa MCP server configured for VS Code AI assistants (.vscode/mcp.json & .mcp.json).', 'Open Config');
      if (choice === 'Open Config') await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(mcpUri));
    })),
    vscode.commands.registerCommand('deployxa.addDomain', (projectId?: string) => run('Adding domain', async () => { const project = projectId ? await clients.client().projects.get(projectId) : await selectProject(); if (!project) return; const domain = await vscode.window.showInputBox({ title: `Add a domain to ${project.name}`, prompt: 'Enter a domain such as app.example.com', ignoreFocusOut: true }); if (!domain) return; await clients.client().domains.add(project.id, { domain: domain.trim() }); DeployxaProjectPanel.show(clients.client(), project, context.extensionUri); })),
    vscode.commands.registerCommand('deployxa.deleteDomain', (projectId?: string, domain?: string) => run('Removing domain', async () => { if (!projectId || !domain) return; const answer = await vscode.window.showWarningMessage(`Remove ${domain}?`, { modal: true }, 'Remove domain'); if (answer !== 'Remove domain') return; await clients.client().domains.delete(projectId, domain); const project = await clients.client().projects.get(projectId); DeployxaProjectPanel.show(clients.client(), project, context.extensionUri); })),
    vscode.commands.registerCommand('deployxa.addEnvironmentVariable', (projectId?: string) => run('Adding environment variable', async () => { const project = projectId ? await clients.client().projects.get(projectId) : await selectProject(); if (!project) return; const key = await vscode.window.showInputBox({ title: 'Environment variable name', prompt: 'For example DATABASE_URL', ignoreFocusOut: true }); if (!key) return; const value = await vscode.window.showInputBox({ title: key, prompt: 'Enter the value. It will be stored securely by Deployxa.', password: true, ignoreFocusOut: true }); if (value === undefined) return; await clients.client().environment.set(project.id, { key: key.trim(), value }); DeployxaProjectPanel.show(clients.client(), project, context.extensionUri); })),
    vscode.commands.registerCommand('deployxa.deleteEnvironmentVariable', (projectId?: string, variableId?: string, key?: string) => run('Removing environment variable', async () => { if (!projectId || !variableId) return; const answer = await vscode.window.showWarningMessage(`Remove ${key || 'this environment variable'}?`, { modal: true }, 'Remove variable'); if (answer !== 'Remove variable') return; await clients.client().environment.delete(variableId); const project = await clients.client().projects.get(projectId); DeployxaProjectPanel.show(clients.client(), project, context.extensionUri); })),
    vscode.commands.registerCommand('deployxa.askAssistant', (projectId?: string, suggested?: string) => run('Asking Deployxa', async () => {
      const project = projectId ? await clients.client().projects.get(projectId) : await selectProject(); if (!project) return;
      const question = await vscode.window.showInputBox({ title: `Ask Deployxa about ${project.name}`, prompt: 'Ask about readiness, deployment failures, domains, or project configuration.', value: suggested ? `How can I fix this recommendation: ${suggested}` : '', ignoreFocusOut: true });
      if (!question) return;
      const response = await clients.client().assistant.chat({ projectId: project.id, message: question });
      const labels = response.actions.map(action => action.label).slice(0, 3);
      const selected = await vscode.window.showInformationMessage('Deployxa Assistant', { modal: true, detail: response.answer }, ...labels);
      const action = response.actions.find(item => item.label === selected);
      if (action?.id === 'view_readiness') DeployxaProjectPanel.show(clients.client(), project, context.extensionUri);
      if (action?.id === 'view_logs') await vscode.commands.executeCommand('deployxa.showLogs');
    })),
    vscode.commands.registerCommand('deployxa.openUrl', (url?: string) => { if (url) void vscode.env.openExternal(vscode.Uri.parse(url)); }),
    vscode.commands.registerCommand('deployxa.dismissHomeProgress', () => home.clearDeploymentProgress()),
    vscode.commands.registerCommand('deployxa.diagnoseDeployment', (node?: DeploymentNode | string) => run('Explaining deployment', async () => { const deployment = await deploymentFrom(node); if (!deployment) return; const diagnosis = await clients.client().deployments.diagnose(deployment.id); const action = await vscode.window.showErrorMessage(`${diagnosis.reason}: ${diagnosis.solution}`, 'View Logs'); if (action) await vscode.commands.executeCommand('deployxa.showLogs', deployment.id); })),
    vscode.commands.registerCommand('deployxa.connectGitHub', () => run('Connecting GitHub', async () => { await funnel.record('github_connection_started'); const flow = await clients.beginGithubConnection(); await vscode.env.openExternal(vscode.Uri.parse(flow.authorizationUrl)); void vscode.window.showInformationMessage('Complete GitHub authorization in your browser. Deployxa will return you securely to VS Code.'); })),
    vscode.commands.registerCommand('deployxa.deployRepository', (repository: { name: string; cloneUrl: string; branch: string }) => run('Preparing repository', async () => {
      const projects = await clients.client().projects.list();
      let project = projects.find(item => item.repositoryUrl.replace(/\.git$/, '') === repository.cloneUrl.replace(/\.git$/, ''));
      if (!project) { project = await clients.client().projects.create({ name: repository.name, repositoryUrl: repository.cloneUrl, branch: repository.branch || 'main' }); await funnel.record('project_created'); }
      if (vscode.workspace.workspaceFolders?.length) await vscode.workspace.getConfiguration('deployxa').update('projectId', project.id, vscode.ConfigurationTarget.Workspace);
      await funnel.record('workspace_linked');
      DeployxaDeployWizard.show(clients.client(), context.extensionUri, project, funnel);
    })),
    vscode.commands.registerCommand('deployxa.deployCurrentWorkspace', () => run('Preparing current project', async () => {
      const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!folder) { void vscode.window.showWarningMessage('Open a project folder in VS Code first.'); return; }
      await deployFromFolder(folder);
    })),
    vscode.commands.registerCommand('deployxa.deployFolder', () => run('Choosing project folder', async () => {
      const picked = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, canSelectMany: false, openLabel: 'Use this project folder' });
      if (picked?.[0]) await deployFromFolder(picked[0].fsPath);
    })),
    vscode.commands.registerCommand('deployxa.deployFolderUpload', () => run('Choosing folder to upload', async () => {
      const picked = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, canSelectMany: false, openLabel: 'Upload and deploy this folder' });
      if (picked?.[0]) await deployByUpload(picked[0].fsPath);
    })),
    vscode.commands.registerCommand('deployxa.linkWorkspace', () => run('Linking workspace', async () => {
      const repository = await readRepository();
      if (!repository) { void vscode.window.showWarningMessage('Open a Git repository workspace before linking it.'); return; }
      const projects = await clients.client().projects.list();
      const match = projects.find(project => project.repositoryUrl === repository.remoteUrl || project.repositoryUrl.replace(/\.git$/, '') === repository.remoteUrl.replace(/\.git$/, ''));
      if (match) { if (vscode.workspace.workspaceFolders?.length) await vscode.workspace.getConfiguration('deployxa').update('projectId', match.id, vscode.ConfigurationTarget.Workspace); void home.refresh(); void vscode.window.showInformationMessage(`Linked workspace to ${match.name}.`); return; }
      const choice = await vscode.window.showQuickPick(projects.map(project => ({ label: project.name, detail: project.repositoryUrl, project })), { placeHolder: `No exact repository match for ${repository.remoteUrl}. Select a project to link.` });
      if (choice) { if (vscode.workspace.workspaceFolders?.length) await vscode.workspace.getConfiguration('deployxa').update('projectId', choice.project.id, vscode.ConfigurationTarget.Workspace); void home.refresh(); }
    })),
    vscode.commands.registerCommand('deployxa.copyUrl', (node?: DeploymentNode | string) => run('Copying URL', async () => { const deployment = await deploymentFrom(node); if (!deployment?.url) { void vscode.window.showWarningMessage('This deployment does not have a live URL yet.'); return; } await vscode.env.clipboard.writeText(deployment.url); void vscode.window.showInformationMessage('Deployment URL copied.'); })),
    vscode.commands.registerCommand('deployxa.selectOrganization', () => run('Selecting organization', async () => {
      const organizations = await clients.client().organizations.list();
      const choice = await vscode.window.showQuickPick(organizations.map(organization => ({ label: organization.name, description: organization.role, organization })), { placeHolder: 'Select an organization' });
      if (choice) { await vscode.workspace.getConfiguration('deployxa').update('organizationId', choice.organization.id, vscode.ConfigurationTarget.Global); tree.refresh(); void home.refresh(); }
    })),
    vscode.commands.registerCommand('deployxa.deploy', (node?: ProjectNode | string) => run('Opening deploy wizard', async () => { const project = node ? await projectFrom(node) : undefined; DeployxaDeployWizard.show(clients.client(), context.extensionUri, project, funnel); })),
    vscode.commands.registerCommand('deployxa.deployConfirmed', (projectId?: string) => run('Starting deployment', async () => {
      const project = projectId ? await clients.client().projects.get(projectId) : undefined; if (!project) return;
      // Upload-backed projects (no git remote) can't be redeployed via git
      // clone — re-uploads a folder to the existing project instead.
      if (isUploadRepository(project.repositoryUrl)) {
        const picked = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, canSelectMany: false, openLabel: 'Re-deploy this folder' });
        if (picked?.[0]) await redeployByUpload(project, picked[0].fsPath);
        return;
      }
      const deployment = await clients.client().deployments.create({ projectId: project.id }); tree.refresh(); home.showDeploymentProgress(project, deployment);
      await funnel.record('first_deployment_started');
      streamDeploymentTo(project, deployment);
    })),
    vscode.commands.registerCommand('deployxa.openProject', (node?: ProjectNode | string) => run('Opening project', async () => { const project = await projectFrom(node); if (project) await vscode.env.openExternal(vscode.Uri.parse(dashboardProjectUrl(dashboardUrl(), project.id))); })),
    vscode.commands.registerCommand('deployxa.openProjectView', (node?: ProjectNode | string) => run('Opening project', async () => { const project = await projectFrom(node); if (project) DeployxaProjectPanel.show(clients.client(), project, context.extensionUri); })),
    vscode.commands.registerCommand('deployxa.openDeployment', (node?: DeploymentNode | string) => run('Opening deployment', async () => { const deployment = await deploymentFrom(node); if (deployment) await vscode.env.openExternal(vscode.Uri.parse(dashboardDeploymentUrl(dashboardUrl(), deployment.id))); })),
    vscode.commands.registerCommand('deployxa.cancelDeployment', (node?: DeploymentNode | string) => run('Cancelling deployment', async () => { const deployment = await deploymentFrom(node); if (!deployment) return; const answer = await vscode.window.showWarningMessage(`Cancel deployment ${deployment.id.slice(0, 8)}?`, { modal: true }, 'Cancel deployment'); if (answer === 'Cancel deployment') { await clients.client().deployments.cancel(deployment.id); tree.refresh(); void home.refresh(); } })),
    vscode.commands.registerCommand('deployxa.rollbackDeployment', (node?: DeploymentNode | string) => run('Rolling back deployment', async () => { const deployment = await deploymentFrom(node); if (!deployment) return; const answer = await vscode.window.showWarningMessage(`Roll back to deployment ${deployment.id.slice(0, 8)}?`, { modal: true }, 'Roll back'); if (answer === 'Roll back') { await clients.client().deployments.rollback(deployment.id); tree.refresh(); void home.refresh(); } })),
    vscode.commands.registerCommand('deployxa.showLogs', (node?: DeploymentNode | string) => run('Loading logs', async () => {
      const deployment = await deploymentFrom(node); if (!deployment) return;
      const logs = await clients.client().logs.list(deployment.id); output.clear(); output.show(true);
      if (Array.isArray(logs)) for (const entry of logs) output.appendLine(`[${entry.timestamp}] ${entry.stream}: ${entry.message}`);
      else output.appendLine(typeof logs.logs === 'string' ? logs.logs : JSON.stringify(logs.logs, null, 2));
    })),
    vscode.commands.registerCommand('deployxa.streamLogs', (node?: DeploymentNode | string) => run('Streaming logs', async () => {
      const deployment = await deploymentFrom(node); if (!deployment) return;
      const controller = new AbortController();
      output.clear(); output.show(true);
      await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `Streaming logs for ${deployment.id.slice(0, 8)}`, cancellable: true }, async (_progress, cancellation) => {
        const disposable = cancellation.onCancellationRequested(() => controller.abort());
        try {
          for await (const logs of clients.client().streamDeploymentLogs(deployment.id, { intervalMs: 2000, signal: controller.signal })) output.appendLine(deploymentLogText(logs));
        } catch (error) {
          if (!controller.signal.aborted) throw error;
        } finally {
          disposable.dispose();
          controller.abort();
        }
      });
    })),
  );

  const intervalSeconds = vscode.workspace.getConfiguration('deployxa').get<number>('refreshIntervalSeconds') || 0;
  if (intervalSeconds > 0) { const timer = setInterval(() => tree.refresh(), intervalSeconds * 1000); context.subscriptions.push({ dispose: () => clearInterval(timer) }); }
}

export function deactivate() {}
