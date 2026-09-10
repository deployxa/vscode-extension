import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const home = readFileSync(join(root, 'src/home.ts'), 'utf8');
const extension = readFileSync(join(root, 'src/extension.ts'), 'utf8');
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { contributes: { commands: Array<{ command: string }>; views: Record<string, Array<{ id: string; type?: string }>> } };

test('GUI-first Home and onboarding are contributed', () => {
  assert.ok(manifest.contributes.views.deployxa.some(view => view.id === 'deployxa.home' && view.type === 'webview'));
  assert.match(home, /Put your app online from VS Code/);
  assert.match(home, /Create Free Account/);
  assert.match(home, /Your applications|Deploy your first application/);
});

test('acquisition funnel is explicit and privacy controlled', () => {
  const funnel = readFileSync(join(root, 'src/funnel.ts'), 'utf8');
  assert.match(home, /deployxa\.createAccount/);
  assert.match(extension, /registration_clicked/);
  assert.match(extension, /first_deployment_started/);
  assert.match(extension, /first_deployment_succeeded/);
  assert.match(funnel, /vscode\.env\.isTelemetryEnabled/);
  assert.match(funnel, /if \(!this\.consent\(\)\) return/);
  assert.match(funnel, /trackExtensionEvent|this\.transport/);
  assert.match(funnel, /catch \{ return; \}/);
  assert.match(extension, /first_deployment_failed/);
  assert.doesNotMatch(funnel, /repositoryUrl|workspacePath|accessToken|sourceCode/);
});

test('deployment handoff focuses a registered Home view command', () => {
  assert.match(extension, /registerCommand\('deployxa\.home\.focus'/);
  assert.match(extension, /workbench\.action\.focusView/);
});

test('Simple and Advanced modes share the same Home implementation', () => {
  assert.match(home, /deployxa\.uiMode/);
  assert.match(home, /Advanced mode/);
  assert.match(home, /Simple mode/);
  assert.equal((home.match(/class DeployxaHome/g) || []).length, 1);
});

test('Home uses existing commands for account, workspace, and deployment actions', () => {
  for (const command of ['deployxa.signIn', 'deployxa.switchAccount', 'deployxa.manageTokens', 'deployxa.signOut', 'deployxa.selectOrganization', 'deployxa.linkWorkspace', 'deployxa.deploy', 'deployxa.showLogs', 'deployxa.cancelDeployment', 'deployxa.rollbackDeployment']) {
    assert.ok(manifest.contributes.commands.some(entry => entry.command === command), `${command} should remain contributed`);
    assert.match(extension, new RegExp(command.replace('.', '\\.')));
  }
});

test('deployment progress, success, failure, and accessibility affordances are present', () => {
  assert.match(home, /aria-live="polite"/);
  assert.match(home, /Your app is live/);
  assert.match(home, /We couldn't start your application/);
  assert.match(home, /prefers-reduced-motion/);
  assert.match(home, /focus-visible/);
});

test('mini dashboard uses authoritative readiness, database, DNS, assistant, and rich progress resources', () => {
  const project = readFileSync(join(root, 'src/project.ts'), 'utf8');
  assert.match(project, /clients\.readiness\.get/);
  assert.match(project, /clients\.database\.metrics/);
  assert.match(project, /clients\.database\.backups/);
  assert.match(project, /clients\.database\.users/);
  assert.match(project, /clients\.dnsGuidance\.get/);
  assert.match(extension, /clients\.client\(\)\.assistant\.chat/);
  assert.match(home, /update\?\.completed/);
  assert.match(home, /update\?\.remaining/);
});

test('direct folder upload path exists for vibe coders without GitHub', () => {
  const upload = readFileSync(join(root, 'src/upload.ts'), 'utf8');
  assert.ok(manifest.contributes.commands.some(entry => entry.command === 'deployxa.deployFolderUpload'));
  // Extension offers upload when there is no git remote instead of a hard stop.
  assert.match(extension, /Upload folder directly/);
  assert.match(extension, /deployByUpload/);
  assert.match(extension, /clients\.client\(\)\.uploadProject/);
  // Upload module packages a folder without requiring git.
  assert.match(upload, /archiveFolder/);
  assert.match(upload, /SKIP_DIRS/);
  assert.match(upload, /100 \* 1024 \* 1024/);
  // Home surfaces the upload action in the empty state and quick actions.
  assert.match(home, /deployxa\.deployFolderUpload/);
  assert.match(home, /Upload a folder directly/);
  assert.match(home, /Upload folder/);
});

test('redeploying an upload-backed project re-uploads instead of git-cloning', () => {
  // Upload-backed projects (upload: sentinel) must not go through the normal
  // git-clone deploy path, which would fail on a non-URL repositoryUrl.
  assert.match(extension, /isUploadRepository\(project\.repositoryUrl\)/);
  assert.match(extension, /redeployByUpload/);
  assert.match(extension, /deployments\.upload\(project\.id/);
});

test('SDK exposes direct archive upload through the Engine', () => {
  const resources = readFileSync(join(root, '..', 'sdk', 'src', 'resources.ts'), 'utf8');
  const client = readFileSync(join(root, '..', 'sdk', 'src', 'client.ts'), 'utf8');
  const transport = readFileSync(join(root, '..', 'sdk', 'src', 'transport.ts'), 'utf8');
  assert.match(resources, /upload\(projectId/);
  assert.match(resources, /\/api\/deployments\/upload/);
  assert.match(client, /uploadProject/);
  assert.match(transport, /sendRaw/);
});

test('upload checks tar availability and shows a friendly error when missing', () => {
  const upload = readFileSync(join(root, 'src/upload.ts'), 'utf8');
  assert.match(upload, /isTarAvailable/);
  assert.match(upload, /execFileSync/);
  assert.match(upload, /tarMissingMessage/);
  assert.match(extension, /isTarAvailable\(\)/);
  assert.match(extension, /tarMissingMessage/);
});

test('upload supports a .deployxaignore file for custom exclusions', () => {
  const upload = readFileSync(join(root, 'src/upload.ts'), 'utf8');
  assert.match(upload, /\.deployxaignore/);
  assert.match(upload, /readIgnoreFile/);
  assert.match(upload, /exclusionPatterns/);
});

test('upload reports byte-level progress and is cancellable', () => {
  assert.match(extension, /uploaded \+= chunk\.length/);
  assert.match(extension, /onCancellationRequested/);
  assert.match(extension, /AbortController/);
  assert.match(extension, /withProgress/);
});

test('upload shows folder size before confirming', () => {
  assert.match(extension, /sizeLabel/);
  assert.match(extension, /MB|KB/);
});

test('upload funnel tracks success and failure', () => {
  assert.match(extension, /upload_deployment_succeeded/);
  assert.match(extension, /upload_deployment_failed/);
});

test('deploy commands are registered in the manifest', () => {
  for (const command of ['deployxa.deployCurrentWorkspace', 'deployxa.deployFolder']) {
    assert.ok(manifest.contributes.commands.some(entry => entry.command === command), `${command} should be contributed`);
  }
});

test('upload-backed projects show a friendly label instead of the upload: sentinel', () => {
  const tree = readFileSync(join(root, 'src/tree.ts'), 'utf8');
  assert.match(home, /Uploaded folder/);
  assert.match(tree, /Uploaded folder/);
});
