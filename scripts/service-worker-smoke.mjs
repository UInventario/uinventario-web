import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { createApplicationServer } from '../server.mjs';

const rootDirectory = resolve('dist', 'uinventario-web', 'browser');
const application = createApplicationServer({
  rootDirectory,
  environment: 'dev',
  apiUpstream: 'https://placeholder.invalid',
});
await new Promise((resolveListening) => application.listen(0, '127.0.0.1', resolveListening));
const address = application.address();
if (!address || typeof address === 'string')
  throw new Error('No fue posible iniciar el smoke Web.');
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
  await page.goto(`${origin}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('app-root').filter({ hasText: 'Iniciar sesión' }).waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

  await closeApplication();
  await page.goto(`${origin}/app`, { waitUntil: 'domcontentloaded' });
  await page.locator('app-root').filter({ hasText: 'Iniciar sesión' }).waitFor();

  assert.equal(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)), true);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.getByText('Escribe un correo electrónico válido.').waitFor();
  await page.getByText('Escribe tu contraseña.').waitFor();
  const fit = await page.evaluate(() => {
    const submit = document.querySelector('button[type="submit"]')?.getBoundingClientRect();
    return {
      horizontalOverflow:
        document.documentElement.scrollWidth > document.documentElement.clientWidth,
      submitVisible: Boolean(submit && submit.top >= 0 && submit.bottom <= window.innerHeight),
    };
  });
  assert.equal(fit.horizontalOverflow, false);
  assert.equal(fit.submitVisible, true);
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/service-worker-offline.png' });
  await context.close();
  console.log('Service Worker smoke OK: shell y config disponibles sin red.');
} finally {
  await browser.close();
  if (!applicationClosed) await closeApplication();
}
