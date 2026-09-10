import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  isTarAvailable,
  estimateFolderSize,
  archiveFolder,
  UPLOAD_LIMIT,
  uploadLimitMessage,
  tarMissingMessage,
} from '../src/upload.js';
import {
  deploymentContextValue,
  isDeploymentActive,
  dashboardProjectUrl,
  dashboardDeploymentUrl,
  nextActiveAccountId,
  deploymentLogText,
} from '../src/model.js';
import { readRepository } from '../src/local.js';
import { FunnelTracker } from '../src/funnel.js';

test('isTarAvailable returns true on Linux environment', () => {
  assert.equal(isTarAvailable(), true);
  assert.ok(typeof tarMissingMessage === 'string');
  assert.ok(typeof uploadLimitMessage === 'string');
  assert.ok(UPLOAD_LIMIT > 0);
});

test('estimateFolderSize calculates size and ignores excluded folders and broken symlinks', () => {
  const dir = mkdtempSync(join(tmpdir(), 'deployxa-test-'));
  try {
    writeFileSync(join(dir, 'index.js'), 'console.log("hello");'); // 21 bytes
    writeFileSync(join(dir, 'package.json'), '{"name":"test"}'); // 15 bytes

    // Excluded directory
    mkdirSync(join(dir, 'node_modules'));
    writeFileSync(join(dir, 'node_modules', 'dep.js'), 'x'.repeat(1000));

    // Excluded git directory
    mkdirSync(join(dir, '.git'));
    writeFileSync(join(dir, '.git', 'config'), 'x'.repeat(500));

    // .deployxaignore custom exclude
    writeFileSync(join(dir, '.deployxaignore'), 'temp-*\n# comment\n');
    writeFileSync(join(dir, 'temp-file.txt'), 'x'.repeat(500));

    // Broken symlink should not crash
    try {
      symlinkSync(join(dir, 'non-existent-target'), join(dir, 'broken-link'));
    } catch {}

    const size = estimateFolderSize(dir);
    // index.js (21) + package.json (15) + .deployxaignore (17) = 53 bytes
    assert.equal(size, 53);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('archiveFolder produces a valid stream with estimated size and filename', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'deployxa-archive-'));
  try {
    writeFileSync(join(dir, 'main.js'), 'console.log("archive");');
    const result = archiveFolder(dir);
    assert.ok(result.stream);
    assert.ok(result.filename.endsWith('.tar.gz'));
    assert.ok(result.estimatedSize > 0);

    const chunks: Buffer[] = [];
    for await (const chunk of result.stream) {
      chunks.push(Buffer.from(chunk));
    }
    const combined = Buffer.concat(chunks);
    assert.ok(combined.length > 0, 'archive stream should contain bytes');
    // Gzip magic number check: 0x1f, 0x8b
    assert.equal(combined[0], 0x1f);
    assert.equal(combined[1], 0x8b);
    result.cleanup();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('model helper functions work properly', () => {
  assert.equal(deploymentContextValue('SUCCESS'), 'deployxa.deployment.success');
  assert.equal(deploymentContextValue('ACTIVE'), 'deployxa.deployment.success');
  assert.equal(deploymentContextValue('BUILDING'), 'deployxa.deployment.active');
  assert.equal(deploymentContextValue('QUEUED'), 'deployxa.deployment.active');
  assert.equal(deploymentContextValue('FAILED'), 'deployxa.deployment');
  assert.equal(deploymentContextValue('CANCELLED'), 'deployxa.deployment');
  assert.equal(deploymentContextValue('ROLLED_BACK'), 'deployxa.deployment');

  assert.equal(isDeploymentActive('BUILDING'), true);
  assert.equal(isDeploymentActive('QUEUED'), true);
  assert.equal(isDeploymentActive('SUCCESS'), false);
  assert.equal(isDeploymentActive('FAILED'), false);
  assert.equal(isDeploymentActive('CANCELLED'), false);
  assert.equal(isDeploymentActive('ACTIVE'), false);
  assert.equal(isDeploymentActive('ROLLED_BACK'), false);

  assert.equal(dashboardProjectUrl('https://deployxa.com/dashboard', 'proj-1'), 'https://deployxa.com/dashboard/projects/proj-1');
  assert.equal(dashboardProjectUrl('https://deployxa.com/dashboard/', 'proj-1?'), 'https://deployxa.com/dashboard/projects/proj-1%3F');
  assert.equal(dashboardDeploymentUrl('https://deployxa.com/dashboard', 'dep-1'), 'https://deployxa.com/dashboard/deployments/dep-1');

  assert.equal(nextActiveAccountId('acc-1', 'acc-1', ['acc-2', 'acc-3']), 'acc-2');
  assert.equal(nextActiveAccountId('acc-2', 'acc-1', ['acc-2', 'acc-3']), 'acc-2');
  assert.equal(nextActiveAccountId('acc-1', 'acc-1', []), undefined);

  assert.equal(deploymentLogText([{ timestamp: '12:00', stream: 'stdout', message: 'Ready' }]), '[12:00] stdout: Ready');
  assert.equal(deploymentLogText('plain string log'), '"plain string log"');
});

test('readRepository handles empty/missing workspace paths gracefully', async () => {
  const result = await readRepository('/non/existent/path');
  assert.equal(result, undefined);
  const undefinedResult = await readRepository(undefined);
  assert.equal(undefinedResult, undefined);
});

test('FunnelTracker tracks events when consent is granted', async () => {
  const store = new Map<string, unknown>();
  const mockContext = {
    globalState: {
      get: (key: string, defaultValue?: unknown) => store.has(key) ? store.get(key) : defaultValue,
      update: async (key: string, value: unknown) => { store.set(key, value); },
    },
  } as any;

  const transmitted: any[] = [];
  const tracker = new FunnelTracker(
    mockContext,
    () => 'test-install-id',
    async input => { transmitted.push(input); return { ok: true }; }
  );

  // Default: no consent -> record does not store or send
  await tracker.record('extension_activated');
  assert.equal(transmitted.length, 0);

  // Enable consent
  await tracker.setConsent(true);
  assert.equal(store.get('deployxa.funnelConsent'), true);

  // Disable consent clears events
  store.set('deployxa.funnelEvents', [{ event: 'extension_activated', at: 'now' }]);
  await tracker.setConsent(false);
  assert.deepEqual(store.get('deployxa.funnelEvents'), []);
});

test('manifest contributes all necessary views, commands, menus, and configuration', () => {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
  const extSource = readFileSync(join(process.cwd(), 'src/extension.ts'), 'utf8');

  // Verify views
  const viewIds = pkg.contributes.views.deployxa.map((v: any) => v.id);
  assert.ok(viewIds.includes('deployxa.home'));
  assert.ok(viewIds.includes('deployxa.projects'));
  assert.ok(viewIds.includes('deployxa.dashboard'));

  // Verify activationEvents
  assert.ok(pkg.activationEvents.includes('onView:deployxa.home'));
  assert.ok(pkg.activationEvents.includes('onView:deployxa.projects'));
  assert.ok(pkg.activationEvents.includes('onView:deployxa.dashboard'));
  assert.ok(pkg.activationEvents.includes('onCommand:deployxa.signIn'));
  assert.ok(pkg.activationEvents.includes('onUri'));

  // Verify all commands in manifest are registered in extension.ts
  for (const cmd of pkg.contributes.commands) {
    assert.ok(extSource.includes(`'${cmd.command}'`), `Command ${cmd.command} should be registered in extension.ts`);
  }

  // Verify context menu entries match deployments properly
  const contextMenus = pkg.contributes.menus['view/item/context'];
  const showLogsMenu = contextMenus.find((m: any) => m.command === 'deployxa.showLogs');
  assert.equal(showLogsMenu.when, 'viewItem =~ /deployxa.deployment/');
  const openDepMenu = contextMenus.find((m: any) => m.command === 'deployxa.openDeployment');
  assert.equal(openDepMenu.when, 'viewItem =~ /deployxa.deployment/');
  const openProjView = contextMenus.find((m: any) => m.command === 'deployxa.openProjectView');
  assert.ok(openProjView, 'openProjectView should be available in context menu');

  // Verify configuration keys
  const configKeys = Object.keys(pkg.contributes.configuration.properties);
  assert.ok(configKeys.includes('deployxa.apiUrl'));
  assert.ok(configKeys.includes('deployxa.dashboardUrl'));
  assert.ok(configKeys.includes('deployxa.organizationId'));
  assert.ok(configKeys.includes('deployxa.projectId'));
  assert.ok(configKeys.includes('deployxa.refreshIntervalSeconds'));
});

