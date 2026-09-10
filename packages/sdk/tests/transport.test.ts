import assert from 'node:assert/strict';
import test from 'node:test';
import { DeployxaClient, DeployxaError } from '../src/index.js';
import { AuthenticationError, ValidationError } from '../src/index.js';

test('client applies bearer and organization context and preserves existing route', async () => {
  let request: Request | undefined;
  const client = new DeployxaClient({
    baseUrl: 'https://api.example.test/', token: 'token-value', organizationId: 'org-1', retries: 0,
    fetch: async (input, init) => {
      request = new Request(input, init);
      return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  await client.projects.list();
  assert.equal(request?.url, 'https://api.example.test/api/projects');
  assert.equal(request?.headers.get('authorization'), 'Bearer token-value');
  assert.equal(request?.headers.get('x-organization-id'), 'org-1');
});

test('client binds the ambient Fetch API for browser-compatible invocation', async () => {
  const originalFetch = globalThis.fetch;
  let receiver: unknown;
  globalThis.fetch = async function (this: unknown) {
    receiver = this;
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
  } as typeof fetch;
  try {
    const client = new DeployxaClient({ baseUrl: 'https://example.test', retries: 0 });
    await client.projects.list();
    assert.equal(receiver, globalThis);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('client normalizes legacy string errors', async () => {
  const client = new DeployxaClient({ retries: 0, fetch: async () => new Response(JSON.stringify({ error: 'Project not found.' }), { status: 404, headers: { 'content-type': 'application/json' } }) });
  await assert.rejects(() => client.projects.get('missing'), (error: unknown) => error instanceof DeployxaError && error.status === 404 && error.message === 'Project not found.');
});

test('client retries safe reads but not mutations', async () => {
  let reads = 0;
  const readClient = new DeployxaClient({ retries: 1, fetch: async () => {
    reads++;
    return reads === 1 ? new Response('{}', { status: 503, headers: { 'content-type': 'application/json' } }) : new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
  } });
  await readClient.projects.list();
  assert.equal(reads, 2);

  let writes = 0;
  const writeClient = new DeployxaClient({ retries: 2, fetch: async () => { writes++; return new Response('{}', { status: 503, headers: { 'content-type': 'application/json' } }); } });
  await assert.rejects(() => writeClient.projects.create({ name: 'x', repositoryUrl: 'https://example.com/repo' }));
  assert.equal(writes, 1);
});

test('client exposes platform namespaces and typed auth errors', async () => {
  const client = new DeployxaClient({ fetch: async (input) => {
    const url = String(input);
    if (url.endsWith('/api/auth/me')) return new Response('{}', { status: 401, headers: { 'content-type': 'application/json' } });
    if (url.endsWith('/api/projects')) return new Response(JSON.stringify({ error: 'invalid project' }), { status: 400, headers: { 'content-type': 'application/json' } });
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
  }, retries: 0 });
  assert.ok(client.runtime && client.ssl && client.databases && client.monitoring && client.metrics && client.workflows);
  await assert.rejects(() => client.users.me(), (error: unknown) => error instanceof AuthenticationError);
  await assert.rejects(() => client.projects.create({ name: '', repositoryUrl: '' }), (error: unknown) => error instanceof ValidationError);
});

test('client exposes ergonomic capability aliases without changing Engine routes', async () => {
  const requests: Array<{ method: string; path: string; body?: unknown }> = [];
  const client = new DeployxaClient({ baseUrl: 'https://example.test', fetch: async (input, init) => {
    const url = new URL(String(input));
    requests.push({ method: String(init?.method), path: `${url.pathname}${url.search}`, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  }});
  await client.assistant.diagnose('project-1');
  await client.deployments.progress('deployment-1');
  await client.dns.guidance('project-1');
  await client.database.summary('database-1');
  assert.deepEqual(requests.map(item => [item.method, item.path]), [
    ['POST', '/api/assistant/chat'],
    ['GET', '/api/deployments/deployment-1/progress'],
    ['GET', '/api/dns-guidance/project-1'],
    ['GET', '/api/database/database-1'],
  ]);
  assert.deepEqual(requests[0].body, { projectId: 'project-1', message: 'Diagnose this project using only Engine evidence.' });
});

test('activity resource preserves the existing Engine activity route and organization context', async () => {
  let request: Request | undefined;
  const client = new DeployxaClient({ baseUrl: 'https://example.test', token: 'token', organizationId: 'org-home', fetch: async (input, init) => {
    request = new Request(input, init);
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
  }});
  await client.activity.list();
  assert.equal(request?.url, 'https://example.test/api/activity');
  assert.equal(request?.headers.get('x-organization-id'), 'org-home');
});

test('deployment polling stops at a terminal state', async () => {
  const client = new DeployxaClient({ fetch: async () => new Response(JSON.stringify({ id: 'd1', projectId: 'p1', status: 'SUCCESS', createdAt: '', updatedAt: '' }), { status: 200, headers: { 'content-type': 'application/json' } }) });
  const values: unknown[] = [];
  for await (const value of client.streamDeployment('d1', { intervalMs: 1 })) values.push(value);
  assert.equal(values.length, 1);
});

test('analytics client sends only the typed extension event payload', async () => {
  let request: Request | undefined;
  const client = new DeployxaClient({ baseUrl: 'https://example.test', retries: 0, fetch: async (input, init) => {
    request = new Request(input, init); return new Response(JSON.stringify({ accepted: true, duplicate: false }), { status: 202, headers: { 'content-type': 'application/json' } });
  }});
  await client.analytics.trackExtensionEvent({ event: 'home_opened', installationId: '00000000-0000-4000-8000-000000000001' });
  assert.equal(request?.url, 'https://example.test/api/analytics/extension/events');
  assert.deepEqual(await request?.json(), { event: 'home_opened', installationId: '00000000-0000-4000-8000-000000000001' });
});

test('analytics client tracks first-party events and batch payloads', async () => {
  const requests: Array<{ url: string; body: unknown }> = [];
  const client = new DeployxaClient({ baseUrl: 'https://example.test', retries: 0, fetch: async (input, init) => {
    const request = new Request(input, init);
    requests.push({ url: request.url, body: await request.json() });
    return new Response(JSON.stringify({ accepted: true, duplicate: false }), { status: 202, headers: { 'content-type': 'application/json' } });
  }});

  await client.analytics.track({
    eventId: '11111111-1111-4111-8111-111111111111',
    eventName: 'marketing_page_viewed',
    source: 'marketing',
    properties: { page: '/', source: 'producthunt' },
  });

  await client.analytics.trackBatch([
    {
      eventId: '22222222-2222-4222-8222-222222222222',
      eventName: 'deployment_started',
      source: 'web',
      properties: { deploymentId: 'd-1', projectId: 'p-1' },
    },
  ]);

  assert.equal(requests[0].url, 'https://example.test/api/analytics/events');
  assert.equal((requests[0].body as any).eventName, 'marketing_page_viewed');
  assert.equal(requests[1].url, 'https://example.test/api/analytics/events');
  assert.equal((requests[1].body as any).events.length, 1);
});

test('analytics client queries admin reporting endpoints with search params', async () => {
  const urls: string[] = [];
  const client = new DeployxaClient({ baseUrl: 'https://example.test', retries: 0, fetch: async (input) => {
    urls.push(String(input));
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  }});

  await client.analytics.getOverview({ from: '2026-08-01T00:00:00Z', to: '2026-08-27T00:00:00Z' });
  await client.analytics.getFunnel({ source: 'vscode' });
  await client.analytics.getAcquisition();
  await client.analytics.getRetention();
  await client.analytics.getDeploymentAnalytics({ runtime: 'Next.js' });
  await client.analytics.getTimeToValue();
  await client.analytics.getFeatureUsage();
  await client.analytics.cleanup(90);

  assert.equal(urls[0], 'https://example.test/api/admin/analytics/overview?from=2026-08-01T00%3A00%3A00Z&to=2026-08-27T00%3A00%3A00Z');
  assert.equal(urls[1], 'https://example.test/api/admin/analytics/funnel?source=vscode');
  assert.equal(urls[2], 'https://example.test/api/admin/analytics/acquisition');
  assert.equal(urls[3], 'https://example.test/api/admin/analytics/retention');
  assert.equal(urls[4], 'https://example.test/api/admin/analytics/deployments?runtime=Next.js');
  assert.equal(urls[5], 'https://example.test/api/admin/analytics/time-to-value');
  assert.equal(urls[6], 'https://example.test/api/admin/analytics/feature-usage');
  assert.equal(urls[7], 'https://example.test/api/admin/analytics/cleanup');
});

