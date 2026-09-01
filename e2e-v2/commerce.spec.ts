import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { expectAccessible, expectViewportFit } from './accessibility.helpers';

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

function credential(name = 'Marketplace Norte') {
  return {
    id: '00000000-0000-4000-8000-000000000101',
    name,
    keyPrefix: 'uic_abcd1234',
    scopes: ['CATALOG_READ', 'STOCK_READ', 'ORDERS_WRITE', 'ORDERS_READ'],
    context: {
      branch: { id: 'branch-1', name: 'Centro' },
      warehouse: { id: 'warehouse-1', name: 'Principal' },
      location: { id: 'location-1', name: 'Piso', code: 'PISO' },
      cashRegister: { id: 'register-1', name: 'Caja 1', code: 'C1' },
      customer: { id: 'customer-1', name: 'Marketplace' },
    },
    active: true,
    rateLimitPerMinute: 60,
    webhook: {
      url: 'https://marketplace.example/webhooks',
      events: ['ORDER_CONFIRMED'],
      enabled: true,
      mode: 'SIMULATOR',
    },
    lastUsedAt: null,
    createdAt: '2026-08-31T10:00:00.000Z',
    updatedAt: '2026-08-31T10:00:00.000Z',
  };
}

async function mockCommerce(page: Page): Promise<string[]> {
  const writes: string[] = [];
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1', '');
    if (path === '/auth/sessions/current') {
      return json(route, {
        data: {
          user: {
            id: 'admin-1',
            email: 'admin@example.com',
            roles: ['ADMIN'],
            permissions: ['TENANT_MANAGE'],
          },
          tenant: { id: 'tenant-1', name: 'Tienda Central' },
          context: {
            branch: { id: 'branch-1', name: 'Centro' },
            warehouse: { id: 'warehouse-1', name: 'Principal' },
            cashRegister: { id: 'register-1', name: 'Caja 1', code: 'C1' },
          },
          nextStep: 'APPLICATION',
        },
        meta: {
          apiVersion: '1',
          sessionExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        },
      });
    }
    if (path === '/organization/branches') {
      return json(route, {
        data: [
          {
            id: 'branch-1',
            name: 'Centro',
            active: true,
            warehouses: [
              {
                id: 'warehouse-1',
                name: 'Principal',
                active: true,
                locations: [{ id: 'location-1', name: 'Piso', code: 'PISO', active: true }],
              },
            ],
            cashRegisters: [{ id: 'register-1', name: 'Caja 1', code: 'C1' }],
          },
        ],
      });
    }
    if (path === '/customers') {
      return json(route, { data: [{ id: 'customer-1', name: 'Marketplace', active: true }] });
    }
    if (path === '/integrations/commerce/credentials' && request.method() === 'GET') {
      return json(route, { data: [credential()] });
    }
    if (path === '/integrations/commerce/credentials' && request.method() === 'POST') {
      writes.push(`${path}:${request.headers()['idempotency-key']}`);
      return json(route, {
        data: {
          ...credential(request.postDataJSON().name),
          id: '00000000-0000-4000-8000-000000000102',
          apiKey: 'uic_secret_once_only',
        },
      });
    }
    if (path === '/integrations/commerce/webhook-deliveries' && request.method() === 'GET') {
      return json(route, {
        data: [
          {
            id: '00000000-0000-4000-8000-000000000201',
            eventId: 'event-1',
            eventType: 'ORDER_CONFIRMED',
            targetUrl: 'https://marketplace.example/webhooks',
            status: 'RETRYABLE_FAILURE',
            attemptCount: 2,
            errorCode: 'PROVIDER_TIMEOUT',
            updatedAt: '2026-08-31T10:00:00.000Z',
            deliveredAt: null,
          },
        ],
      });
    }
    if (path.endsWith('/replay') && request.method() === 'POST') {
      writes.push(`${path}:${request.headers()['idempotency-key']}`);
      return json(route, {
        data: {
          id: '00000000-0000-4000-8000-000000000201',
          eventId: 'event-1',
          eventType: 'ORDER_CONFIRMED',
          targetUrl: 'https://marketplace.example/webhooks',
          status: 'SUCCEEDED',
          attemptCount: 3,
          errorCode: null,
          updatedAt: '2026-08-31T10:01:00.000Z',
          deliveredAt: '2026-08-31T10:01:00.000Z',
        },
      });
    }
    if (path === '/integrations/commerce/openapi') {
      return json(route, {
        openapi: '3.1.0',
        info: { title: 'UInventario External Commerce API', version: '1.0.0' },
        servers: [{ url: '/external/v1' }],
        paths: {
          '/catalog': {
            get: {
              summary: 'Catálogo incremental',
              'x-required-scope': 'CATALOG_READ',
              responses: { '200': { description: 'Catálogo' } },
            },
          },
          '/orders': {
            post: {
              summary: 'Crear pedido idempotente',
              'x-required-scope': 'ORDERS_WRITE',
              responses: { '201': { description: 'Pedido' } },
            },
          },
        },
        'x-webhook-contract': {
          version: '1',
          signatureHeader: 'X-UInventario-Signature',
          signature: 'HMAC-SHA256',
          attempts: { automatic: 3, controlledMaximumTotal: 5 },
        },
      });
    }
    return json(route, { message: `Unhandled ${request.method()} ${path}` }, 404);
  });
  return writes;
}

test('administers marketplace channels, synchronization and the external contract securely', async ({
  page,
}, testInfo) => {
  const writes = await mockCommerce(page);
  await page.goto('./administracion/comercio');

  await expect(
    page.getByRole('heading', { name: 'Comercio electrónico', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Marketplace Norte' })).toBeVisible();
  await expect(page.getByText('uic_abcd1234••••')).toBeVisible();
  await expect(page.getByText('secret_once_only')).toHaveCount(0);
  await expectAccessible(page, 'Canales de comercio');
  await page.screenshot({ path: testInfo.outputPath('commerce-channels.png'), fullPage: true });

  await page.getByRole('button', { name: 'Nuevo canal' }).click();
  await page.getByLabel('Nombre').fill('Marketplace Sur');
  await page.getByRole('button', { name: 'Emitir credencial' }).click();
  const secretDialog = page.getByRole('alertdialog');
  await expect(secretDialog).toBeVisible();
  await expect(secretDialog).not.toContainText('uic_secret_once_only');
  await page.screenshot({ path: testInfo.outputPath('commerce-secret-masked.png') });
  await secretDialog.getByRole('button', { name: 'Mostrar una vez' }).click();
  await expect(secretDialog).toContainText('uic_secret_once_only');
  await secretDialog.getByRole('button', { name: /cerrar y borrar/i }).click();

  await page.getByRole('button', { name: 'Sincronización' }).click();
  await expect(page.getByText('PROVIDER_TIMEOUT')).toBeVisible();
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByText('SUCCEEDED', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Contrato API' }).click();
  await expect(page.getByText('Crear pedido idempotente')).toBeVisible();
  await expect(page.locator('.idempotent')).toHaveCount(2);
  await expectAccessible(page, 'Contrato externo de comercio');
  await expectViewportFit(page, 'Consola de comercio');
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelector<HTMLElement>('#workspace-content')?.scrollTo(0, 0);
  });
  await page.screenshot({ path: testInfo.outputPath('commerce-contract.png'), fullPage: true });

  expect(writes).toHaveLength(2);
  expect(writes.every((write) => /commerce-(create|replay)-[0-9a-f-]{36}$/.test(write))).toBe(true);
});
