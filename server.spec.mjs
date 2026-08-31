import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { createApplicationServer } from './server.mjs';

let application;
let applicationUrl;
let rootDirectory;
let upstream;
let upstreamUrl;

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

before(async () => {
  rootDirectory = await mkdtemp(join(tmpdir(), 'uinventario-web-'));
  await writeFile(join(rootDirectory, 'index.html'), '<h1>UInventario</h1>');
  await writeFile(join(rootDirectory, 'main-ABCDEFGH.js'), 'globalThis.ready=true;');
  await mkdir(join(rootDirectory, 'v2'));
  await writeFile(join(rootDirectory, 'v2', 'index.html'), '<h1>UInventario Web V2</h1>');
  await writeFile(join(rootDirectory, 'v2', 'main-HGFEDCBA.js'), 'globalThis.v2Ready=true;');

  upstream = createServer((request, response) => {
    response.writeHead(200, {
      'content-type': 'application/json',
      'set-cookie': ['uinventario_session=test; HttpOnly; Secure', 'device=test; Secure'],
    });
    response.end(JSON.stringify({ path: request.url, cookie: request.headers.cookie ?? null }));
  });
  upstreamUrl = await listen(upstream);

  application = createApplicationServer({
    rootDirectory,
    environment: 'local',
    apiUpstream: upstreamUrl,
  });
  applicationUrl = await listen(application);
});

after(async () => {
  await Promise.all([
    new Promise((resolve) => application.close(resolve)),
    new Promise((resolve) => upstream.close(resolve)),
  ]);
  await rm(rootDirectory, { recursive: true, force: true });
});

test('serves dynamic same-origin configuration and health', async () => {
  const configResponse = await fetch(`${applicationUrl}/config.json`);
  assert.equal(configResponse.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await configResponse.json(), {
    environment: 'local',
    apiBaseUrl: '/api/v1',
  });
  const v2ConfigResponse = await fetch(`${applicationUrl}/v2/config.json`);
  assert.equal(v2ConfigResponse.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await v2ConfigResponse.json(), {
    environment: 'local',
    apiBaseUrl: '/api/v1',
  });

  const healthResponse = await fetch(`${applicationUrl}/health/live`);
  assert.equal(healthResponse.status, 200);
  assert.match(healthResponse.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.match(
    healthResponse.headers.get('permissions-policy'),
    /camera=\(self\).*microphone=\(\)/,
  );
  assert.equal(healthResponse.headers.get('x-frame-options'), 'DENY');
  assert.equal(healthResponse.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(healthResponse.headers.get('strict-transport-security'), null);
  assert.deepEqual(await healthResponse.json(), { status: 'ok' });
});

test('serves assets and falls back to the Angular entry point', async () => {
  const assetResponse = await fetch(`${applicationUrl}/main-ABCDEFGH.js`);
  assert.equal(assetResponse.status, 200);
  assert.match(assetResponse.headers.get('cache-control'), /immutable/);

  const routeResponse = await fetch(`${applicationUrl}/productos/123`);
  assert.equal(routeResponse.status, 200);
  assert.equal(await routeResponse.text(), '<h1>UInventario</h1>');
});

test('serves Web V2 in isolation and keeps its own route fallback', async () => {
  const assetResponse = await fetch(`${applicationUrl}/v2/main-HGFEDCBA.js`);
  assert.equal(assetResponse.status, 200);
  assert.match(assetResponse.headers.get('cache-control'), /immutable/);

  const entryResponse = await fetch(`${applicationUrl}/v2`);
  assert.equal(entryResponse.status, 200);
  assert.equal(await entryResponse.text(), '<h1>UInventario Web V2</h1>');

  const routeResponse = await fetch(`${applicationUrl}/v2/productos/123`);
  assert.equal(routeResponse.status, 200);
  assert.equal(await routeResponse.text(), '<h1>UInventario Web V2</h1>');
});

test('proxies API requests and preserves session cookies', async () => {
  const response = await fetch(`${applicationUrl}/api/v1/auth/sessions/current`, {
    headers: { cookie: 'uinventario_session=browser-token' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.getSetCookie().length, 2);
  assert.deepEqual(await response.json(), {
    path: '/api/v1/auth/sessions/current',
    cookie: 'uinventario_session=browser-token',
  });
});

test('rejects insecure production upstreams', () => {
  assert.throws(
    () => createApplicationServer({ environment: 'prod', apiUpstream: 'http://api.invalid' }),
    /secure origin/,
  );
});

test('enables transport security outside local development', async () => {
  const secureApplication = createApplicationServer({
    rootDirectory,
    environment: 'dev',
    apiUpstream: 'https://api.example.test',
  });
  const secureUrl = await listen(secureApplication);
  try {
    const response = await fetch(`${secureUrl}/health/live`);
    assert.match(response.headers.get('strict-transport-security'), /max-age=31536000/);
  } finally {
    await new Promise((resolve) => secureApplication.close(resolve));
  }
});
