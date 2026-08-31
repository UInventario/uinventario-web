import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { createApplicationServer } from '../server.mjs';

const deploymentRoot = await mkdtemp(join(tmpdir(), 'uinventario-v2-sw-'));
const buildRoot = resolve('dist', 'uinventario-web-v2', 'browser');
await mkdir(join(deploymentRoot, 'v2'));
await cp(buildRoot, join(deploymentRoot, 'v2'), {
  recursive: true,
});
const builtScripts = (await readdir(buildRoot)).filter((file) => file.endsWith('.js'));
const application = createApplicationServer({
  rootDirectory: deploymentRoot,
  environment: 'dev',
  apiUpstream: 'https://placeholder.invalid',
});
await new Promise((resolveListening) => application.listen(0, '127.0.0.1', resolveListening));
const address = application.address();
if (!address || typeof address === 'string') throw new Error('No fue posible iniciar Web V2.');
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch();
let applicationClosed = false;

async function closeApplication() {
  application.closeAllConnections();
  await new Promise((resolveClosed, reject) =>
    application.close((error) => (error ? reject(error) : resolveClosed())),
  );
  applicationClosed = true;
}

try {
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const page = await context.newPage();
  await page.goto(`${origin}/v2/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('ui-root').filter({ hasText: 'Iniciar sesión' }).waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await page.locator('ui-root').filter({ hasText: 'Iniciar sesión' }).waitFor();
  const cachedScripts = await page.evaluate(async () => {
    const urls = [];
    for (const cacheName of await caches.keys()) {
      const cache = await caches.open(cacheName);
      urls.push(...(await cache.keys()).map((request) => request.url));
    }
    return [...new Set(urls.filter((url) => url.endsWith('.js')))];
  });
  assert.ok(cachedScripts.length > 0, 'El shell usado debe quedar cacheado.');
  assert.ok(
    cachedScripts.length < builtScripts.length,
    'La instalación inicial no debe descargar todos los chunks de ruta.',
  );

  await closeApplication();
  await page.goto(`${origin}/v2/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('ui-root').filter({ hasText: 'Iniciar sesión' }).waitFor();
  assert.equal(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)), true);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    true,
  );
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/service-worker-v2-offline.png' });
  await context.close();
  console.log('Service Worker V2 smoke OK: shell y configuración disponibles sin red.');
} finally {
  await browser.close();
  if (!applicationClosed) await closeApplication();
  await rm(deploymentRoot, { recursive: true, force: true });
}
