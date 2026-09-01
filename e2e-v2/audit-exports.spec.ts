import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

const exportId = '00000000-0000-4000-8000-000000000001';
const failedExportId = '00000000-0000-4000-8000-000000000002';
const actorId = '11111111-1111-4111-8111-111111111111';

interface MockState {
  readonly requests: string[];
  exportPolls: number;
  retryRequested: boolean;
  createBody: Record<string, unknown> | null;
}

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockControl(page: Page): Promise<MockState> {
  const state: MockState = {
    requests: [],
    exportPolls: 0,
    retryRequested: false,
    createBody: null,
  };
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    state.requests.push(`${request.method()} ${path}${url.search}`);

    if (path === '/auth/sessions/current') {
      return fulfillJson(route, {
        data: {
          user: {
            id: 'user-1',
            email: 'admin@example.com',
            roles: ['ADMIN'],
            permissions: [
              'TENANT_MANAGE',
              'PRODUCTS_MANAGE',
              'SALES_MANAGE',
              'INVENTORY_VIEW',
              'AUDIT_VIEW',
              'AUDIT_EXPORT',
            ],
          },
          tenant: { id: 'tenant-1', name: 'Tienda Central' },
          context: {
            branch: { id: 'branch-1', name: 'Centro' },
            warehouse: { id: 'warehouse-1', name: 'Principal' },
            cashRegister: { id: 'register-1', name: 'Caja 1', code: 'CAJA-1' },
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
      return fulfillJson(route, {
        data: [
          {
            id: 'branch-1',
            name: 'Centro',
            timezone: 'America/Mexico_City',
            active: true,
            warehouses: [{ id: 'warehouse-1', name: 'Principal', active: true, locations: [] }],
            cashRegisters: [{ id: 'register-1', name: 'Caja 1', code: 'CAJA-1' }],
          },
        ],
        meta: { apiVersion: '1' },
      });
    }
    if (path === '/audit-events/export') {
      return route.fulfill({
        status: 200,
        contentType: 'text/csv',
        headers: { 'Content-Disposition': 'attachment; filename="audit-2026-08-31.csv"' },
        body: 'sequence,action\n47,PRODUCT_UPDATED\n',
      });
    }
    if (path === '/audit-events') {
      return fulfillJson(route, {
        data: [
          {
            id: 'audit-1',
            sequence: 47,
            action: 'PRODUCT_UPDATED',
            entityType: 'PRODUCT',
            entityId: 'product-1',
            correlationId: 'request-47',
            origin: 'WEB',
            createdAt: '2026-08-30T18:00:00.000Z',
            retentionUntil: '2027-08-30T18:00:00.000Z',
            actor: { id: actorId, email: 'ana@example.com' },
            impersonator: null,
            before: { price: '100.00' },
            after: { price: '119.00' },
            integrity: { valid: true, hash: 'hash-47', previousHash: 'hash-46' },
          },
        ],
        meta: {
          apiVersion: '1',
          retention: { minimumDays: 365, policy: 'APPEND_ONLY' },
          integrity: { valid: true },
          pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
        },
      });
    }
    if (path === '/data-exports' && request.method() === 'POST') {
      state.createBody = request.postDataJSON() as Record<string, unknown>;
      return fulfillJson(route, { data: job(exportId, 'PENDING'), meta: { apiVersion: '1' } }, 202);
    }
    if (path === `/data-exports/${exportId}` && request.method() === 'GET') {
      state.exportPolls += 1;
      return fulfillJson(route, {
        data: job(exportId, state.exportPolls >= 2 ? 'COMPLETED' : 'PROCESSING'),
        meta: { apiVersion: '1' },
      });
    }
    if (path === `/data-exports/${failedExportId}` && request.method() === 'GET') {
      return fulfillJson(route, {
        data: job(failedExportId, state.retryRequested ? 'COMPLETED' : 'FAILED'),
        meta: { apiVersion: '1' },
      });
    }
    if (path === `/data-exports/${failedExportId}/retry`) {
      state.retryRequested = true;
      return fulfillJson(
        route,
        {
          data: job(failedExportId, 'PENDING'),
          meta: { apiVersion: '1' },
        },
        202,
      );
    }
    if (path.endsWith('/download')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers: { 'Content-Disposition': 'attachment; filename="sales-2026-08-31.xlsx"' },
        body: 'mock-xlsx',
      });
    }
    await route.abort('failed');
  });
  return state;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
});

test('filters audit traceability and exports the same result', async ({ page }) => {
  const state = await mockControl(page);
  await page.goto('./reportes/auditoria');

  await expect(page.getByRole('heading', { name: 'Auditoría', exact: true })).toBeVisible();
  await expect(page.getByText('Cadena íntegra')).toBeVisible();
  await page.getByLabel('Buscar').fill('ana@example.com');
  await page.getByLabel('Acción').fill('PRODUCT_UPDATED');
  await page.getByLabel('Tipo de entidad').fill('PRODUCT');
  await page.getByLabel('Desde').fill('2026-08-01');
  await page.getByLabel('Hasta').fill('2026-08-31');
  await page.getByRole('button', { name: 'Aplicar' }).click();

  await expect(page).toHaveURL(/action=PRODUCT_UPDATED/);
  await expect(page).toHaveURL(/entityType=PRODUCT/);
  await expect
    .poll(() =>
      state.requests.some(
        (entry) =>
          entry.includes('/audit-events?') &&
          entry.includes('action=PRODUCT_UPDATED') &&
          entry.includes('dateFrom=2026-08-01'),
      ),
    )
    .toBe(true);

  await page.getByRole('button', { name: 'Filtrar' }).click();
  await expect(page).toHaveURL(new RegExp(`actorId=${actorId}`));
  await page.getByRole('button', { name: 'Ver cambios' }).click();
  await expect(page.getByText('"price": "119.00"')).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV' }).click();
  expect((await download).suggestedFilename()).toBe('audit-2026-08-31.csv');
});

test('creates, follows and downloads an asynchronous export', async ({ page }) => {
  const state = await mockControl(page);
  await page.goto('./reportes/exportaciones');

  await expect(page.getByRole('heading', { name: 'Exportaciones de datos' })).toBeVisible();
  await page.getByLabel('Conjunto de datos').selectOption('SALES');
  await page.getByLabel('Formato').selectOption('XLSX');
  await page.getByLabel('Buscar dentro de los datos').fill('V-000119');
  await page.getByLabel('Estado de la venta').selectOption('COMPLETED');
  await page.getByLabel('Desde').fill('2026-08-01');
  await page.getByLabel('Hasta').fill('2026-08-31');
  await page.getByLabel('Incluir datos personales permitidos').check();
  await page.getByRole('button', { name: 'Generar exportación' }).click();

  await expect(page.getByText('En cola')).toBeVisible();
  await expect(page.getByText('Lista', { exact: true })).toBeVisible({ timeout: 8_000 });
  expect(state.exportPolls).toBeGreaterThanOrEqual(2);
  expect(state.requests.find((entry) => entry === 'POST /data-exports')).toBeTruthy();
  expect(state.createBody).toEqual({
    dataset: 'SALES',
    format: 'XLSX',
    q: 'V-000119',
    saleStatus: 'COMPLETED',
    dateFrom: '2026-08-01',
    dateTo: '2026-08-31',
    includeSensitive: true,
  });

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar' }).click();
  expect((await download).suggestedFilename()).toBe('sales-2026-08-31.xlsx');
});

test('restores a failed job for the current tenant and retries it', async ({ page }) => {
  await page.addInitScript((id) => {
    localStorage.setItem('uinventario:data-exports:tenant-1:user-1', JSON.stringify([id]));
  }, failedExportId);
  const state = await mockControl(page);
  await page.goto('./reportes/exportaciones');

  await expect(page.getByText('Falló')).toBeVisible();
  await expect(page.getByText('No fue posible generar el archivo.')).toBeVisible();
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect.poll(() => state.retryRequested).toBe(true);
  await expect(page.getByText('Lista', { exact: true })).toBeVisible({ timeout: 8_000 });
});

test('ignores hidden period filters after switching to products', async ({ page }) => {
  const state = await mockControl(page);
  await page.goto('./reportes/exportaciones');

  await page.getByLabel('Conjunto de datos').selectOption('SALES');
  await page.getByLabel('Desde').fill('2026-08-31');
  await page.getByLabel('Hasta').fill('2026-08-01');
  await page.getByLabel('Conjunto de datos').selectOption('PRODUCTS');
  await page.getByRole('button', { name: 'Generar exportación' }).click();

  await expect.poll(() => state.createBody).not.toBeNull();
  expect(state.createBody).toEqual({
    dataset: 'PRODUCTS',
    format: 'CSV',
    productStatus: 'ALL',
    includeSensitive: false,
  });
});

test('has no page-level horizontal overflow', async ({ page }, testInfo) => {
  await mockControl(page);
  await page.goto('./reportes/auditoria');
  await expect(page.getByRole('heading', { name: 'Auditoría', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: `test-results/uin199-audit-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.goto('./reportes/exportaciones');
  await expect(page.getByRole('heading', { name: 'Exportaciones de datos' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Exportaciones' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: `test-results/uin199-exports-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

function job(id: string, status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED') {
  return {
    id,
    dataset: 'SALES',
    format: 'XLSX',
    status,
    rowCount: status === 'COMPLETED' ? 23 : null,
    excludedColumns: ['customerContact'],
    errorCode: status === 'FAILED' ? 'EXPORT_GENERATION_FAILED' : null,
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    createdAt: new Date().toISOString(),
    completedAt: status === 'COMPLETED' ? new Date().toISOString() : null,
    downloadReady: status === 'COMPLETED',
  };
}
