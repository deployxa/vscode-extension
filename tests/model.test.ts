import assert from 'node:assert/strict';
import test from 'node:test';
import { dashboardDeploymentUrl, dashboardProjectUrl, deploymentContextValue, deploymentLogText, isDeploymentActive, nextActiveAccountId } from '../src/model.js';

test('deployment context distinguishes active, successful, and terminal operations', () => {
  assert.equal(deploymentContextValue('BUILDING'), 'deployxa.deployment.active');
  assert.equal(deploymentContextValue('SUCCESS'), 'deployxa.deployment.success');
  assert.equal(deploymentContextValue('FAILED'), 'deployxa.deployment');
  assert.equal(isDeploymentActive('QUEUED'), true);
  assert.equal(isDeploymentActive('CANCELLED'), false);
});

test('dashboard links encode identifiers and normalize the base URL', () => {
  assert.equal(dashboardProjectUrl('https://deployxa.com/dashboard/', 'project one'), 'https://deployxa.com/dashboard/projects/project%20one');
  assert.equal(dashboardDeploymentUrl('https://deployxa.com/dashboard/', 'deployment/one'), 'https://deployxa.com/dashboard/deployments/deployment%2Fone');
});

test('removing the active account selects the first remaining account', () => {
  assert.equal(nextActiveAccountId('account-1', 'account-1', ['account-2']), 'account-2');
  assert.equal(nextActiveAccountId('account-2', 'account-1', ['account-2']), 'account-2');
  assert.equal(nextActiveAccountId('account-1', 'account-1', []), undefined);
});

test('deployment logs are rendered as inert text', () => {
  assert.equal(deploymentLogText([{ timestamp: 'now', stream: 'stdout', message: '$(touch /tmp/unsafe)' }]), '[now] stdout: $(touch /tmp/unsafe)');
  assert.equal(deploymentLogText({ status: 'waiting' }), '{\n  "status": "waiting"\n}');
});
