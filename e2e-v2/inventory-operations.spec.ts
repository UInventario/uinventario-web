import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

const product = {
  id: 'a9766220-d36e-44da-9ea1-6d88471073a1',
  name: 'Café molido 500 g',
  sku: 'CAFE-500',
};
const location = {
  id: '48a5e685-22ca-4580-9b35-37a8cb20211f',
  name: 'Piso de venta',
  code: 'PV-01',
};
const sessionId = '45183b53-4007-4b18-8131-d30b27f96b88';

function userSession(permissions: string[]) {
  return {
    data: {
      user: { id: 'admin-1', email: 'admin@example.com', roles: ['ADMIN'], permissions },
      tenant: { id: 'tenant-1', name: 'Tienda Central' },
      context: {
        branch: { id: 'branch-1', name: 'Centro' },
        warehouse: { id: 'warehouse-1', name: 'Principal' },
        cashRegister: null,
      },
      nextStep: 'APPLICATION',
    },
    meta: { apiVersion: '1', sessionExpiresAt: new Date(Date.now() + 3_600_000).toISOString() },
  };
}

function countSession(status: 'OPEN' | 'CLOSED' = 'OPEN', counted: string | null = null) {
  return {
    id: sessionId,
    status,
    blind: true,
    branch: { id: 'branch-1', name: 'Centro' },
    warehouse: { id: 'warehouse-1', name: 'Principal' },
    location,
    createdBy: { id: 'admin-1', email: 'admin@example.com' },
    closedBy: status === 'CLOSED' ? { id: 'admin-1', email: 'admin@example.com' } : null,
    createdAt: '2026-08-30T20:00:00.000Z',
    closedAt: status === 'CLOSED' ? '2026-08-30T20:10:00.000Z' : null,
    lines: [
      {
        product: { ...product, baseUnit: 'UNIT', quantityPrecision: 0, minimumQuantity: '5.000' },
        snapshotQuantity: '8.000',
        countedQuantity: counted,
        varianceQuantity: counted ? '-1.000' : null,
        attemptCount: counted ? 1 : 0,
        countedBy: counted ? { id: 'admin-1', email: 'admin@example.com' } : null,
        countedAt: counted ? '2026-08-30T20:05:00.000Z' : null,
        movementId: status === 'CLOSED' ? 'movement-adjustment-1' : null,
        attempts: counted
          ? [
              {
                attempt: 1,
                countedQuantity: counted,
                responsible: { id: 'admin-1', email: 'admin@example.com' },
                createdAt: '2026-08-30T20:05:00.000Z',
              },
            ]
          : [],
      },
    ],
  };
}

const preview = {
  id: '3b6fb2a8-7d63-48c9-88e1-918d79c0ab3f',
  mode: 'COUNT',
  status: 'PREVIEWED',
  sourceFilename: 'conteo.csv',
  policy: 'ATOMIC',
  canConfirm: true,
  summary: { rows: 1, validRows: 1, errorRows: 0, movements: null },
  rows: [
    {
      id: 'import-row-1',
      rowNumber: 2,
      product,
      location,
      state: 'AVAILABLE',
      targetQuantity: '7.000',
      currentQuantity: '8.000',
      difference: '-1.000',
      reason: 'Conteo mensual',
      errors: [],
    },
  ],
  confirmedAt: null,
};

const invalidPreview = {
  ...preview,
  id: 'f8fe7ddd-3150-49d9-af83-78a029a51dad',
  sourceFilename: 'con-errores.csv',
  canConfirm: false,
  summary: { rows: 1, validRows: 0, errorRows: 1, movements: null },
  rows: [
    {
      ...preview.rows[0],
      id: 'invalid-row-1',
      product: null,
      errors: [{ code: 'PRODUCT_NOT_FOUND', message: 'SKU desconocido en esta empresa.' }],
    },
  ],
};

const initialAlert = {
  product,
  location,
  status: 'LOW',
  availableQuantity: '3.000',
  threshold: '5.000',
  transitionedAt: '2026-08-30T19:00:00.000Z',
};

async function json(route: Route, data: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
}

async function mockOperations(page: Page, permissions: string[]) {
  let sessions: ReturnType<typeof countSession>[] = [];
  let alert = initialAlert;
  let importApplied = false;
  let confirmKey: string | undefined;
  let previewCalls = 0;
  const writes: { path: string; key?: string; body?: unknown }[] = [];

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    const method = request.method();
    const key = request.headers()['idempotency-key'];
    if (path === '/auth/sessions/current') return json(route, userSession(permissions));
    if (path === '/inventory/count-sessions' && method === 'GET') {
      return json(route, { data: sessions, meta: { apiVersion: '1' } });
    }
    if (path === '/inventory/count-sessions' && method === 'POST') {
      writes.push({ path, key, body: request.postDataJSON() });
      sessions = [countSession()];
      return json(
        route,
        { data: sessions[0], meta: { apiVersion: '1', idempotentReplay: false } },
        201,
      );
    }
    if (path === `/inventory/count-sessions/${sessionId}` && method === 'GET') {
      return json(route, { data: sessions[0], meta: { apiVersion: '1' } });
    }
    if (path.includes(`/inventory/count-sessions/${sessionId}/lines/`) && method === 'PUT') {
      writes.push({ path, body: request.postDataJSON() });
      sessions = [countSession('OPEN', '7.000')];
      return json(route, { data: sessions[0], meta: { apiVersion: '1' } });
    }
    if (path === `/inventory/count-sessions/${sessionId}/close` && method === 'POST') {
      writes.push({ path, body: request.postDataJSON() });
      sessions = [countSession('CLOSED', '7.000')];
      return json(route, { data: sessions[0], meta: { apiVersion: '1' } });
    }
    if (path === '/inventory/locations') {
      return json(route, { data: [location], meta: { apiVersion: '1' } });
    }
    if (path === '/inventory/stock') {
      return json(route, {
        data: [{ product, totalQuantity: '8.000' }],
        meta: { pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 } },
      });
    }
    if (path === '/inventory/imports/preview' && method === 'POST') {
      writes.push({ path });
      previewCalls += 1;
      return json(
        route,
        { data: previewCalls === 1 ? invalidPreview : preview, meta: { apiVersion: '1' } },
        201,
      );
    }
    if (path === `/inventory/imports/${preview.id}/confirm` && method === 'POST') {
      writes.push({ path, key });
      if (!importApplied) {
        importApplied = true;
        confirmKey = key;
        return json(
          route,
          { code: 'TEMPORARY_FAILURE', message: 'Confirmación interrumpida.' },
          503,
        );
      }
      if (key !== confirmKey) return json(route, { code: 'IDEMPOTENCY_KEY_REUSED' }, 409);
      return json(route, {
        data: {
          ...preview,
          status: 'CONFIRMED',
          summary: { ...preview.summary, movements: 1 },
          confirmedAt: '2026-08-30T20:20:00.000Z',
        },
        meta: { apiVersion: '1', idempotentReplay: true },
      });
    }
    if (path === '/inventory/stock-alerts' && method === 'GET') {
      return json(route, {
        data: [alert],
        meta: {
          apiVersion: '1',
          defaultThreshold: '5.000',
          scope: {
            branch: { id: 'branch-1', name: 'Centro' },
            warehouse: { id: 'warehouse-1', name: 'Principal' },
          },
          pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        },
      });
    }
    if (path.includes('/inventory/stock-alerts/products/') && method === 'PUT') {
      const body = request.postDataJSON() as { threshold: string };
      writes.push({ path, body });
      alert = { ...alert, threshold: body.threshold, status: 'RECOVERED' };
      return json(route, { data: alert, meta: { apiVersion: '1', defaultThreshold: '5.000' } });
    }
    return json(route, { message: `Unhandled ${method} ${path}` }, 404);
  });
  return writes;
}

test('runs count approval, atomic import and actionable alerts', async ({ page }, testInfo) => {
  const writes = await mockOperations(page, [
    'INVENTORY_VIEW',
    'INVENTORY_COUNT',
    'INVENTORY_APPROVE',
    'INVENTORY_ADJUST',
  ]);
  await page.goto('./inventario/control?view=counts');
  const workspace = page.locator('ui-inventory-operations-page');
  await page.getByRole('button', { name: 'Nueva sesión' }).click();
  await page.getByLabel('Productos disponibles').getByText('Café molido 500 g').click();
  await page.getByRole('button', { name: 'Crear sesión' }).click();
  await expect(page.getByText('Los productos quedaron asignados')).toBeVisible();
  await page.getByRole('textbox', { name: 'Conteo' }).fill('7.000');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await page.getByLabel('Referencia').fill('CONTEO-2026-001');
  await page.getByLabel('Motivo').fill('Conteo físico mensual');
  await page.getByRole('button', { name: 'Aprobar' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Conteo aprobado' })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath(`inventory-count-${testInfo.project.name}.png`),
    fullPage: true,
  });

  await workspace.getByRole('button', { name: 'Importación' }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'con-errores.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('sku,location,quantity,state,reason\nNO-EXISTE,PV-01,7,AVAILABLE,Conteo'),
  });
  await page.getByRole('button', { name: 'Previsualizar' }).click();
  await expect(page.getByText('SKU desconocido en esta empresa.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar importación' })).toBeDisabled();
  await page.locator('input[type=file]').setInputFiles({
    name: 'conteo.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('sku,location,quantity,state,reason\nCAFE-500,PV-01,7,AVAILABLE,Conteo'),
  });
  await page.getByRole('button', { name: 'Previsualizar' }).click();
  await expect(page.getByText('-1.000')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath(`inventory-import-${testInfo.project.name}.png`),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Confirmar importación' }).click();
  await expect(page.getByText('1 movimiento(s) auditado(s)')).toBeVisible();

  await workspace.getByRole('button', { name: 'Alertas' }).click();
  await expect(page.locator('.alerts article').getByText('Stock bajo')).toBeVisible();
  await page.getByLabel('Nuevo umbral').fill('2.000');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Umbral actualizado')).toBeVisible();
  await expect(page.getByText('Recuperada', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Revisar stock/ })).toHaveAttribute(
    'href',
    /q=CAFE-500/,
  );

  const importWrites = writes.filter(({ path }) => path.includes('/confirm'));
  expect(importWrites).toHaveLength(2);
  expect(importWrites[0].key).toBeTruthy();
  expect(importWrites[1].key).toBe(importWrites[0].key);
  const createWrite = writes.find(({ path }) => path === '/inventory/count-sessions');
  expect(createWrite?.key).toBeTruthy();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath(`inventory-operations-${testInfo.project.name}.png`),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test('keeps operational mutations hidden for a read-only inventory user', async ({ page }) => {
  await mockOperations(page, ['INVENTORY_VIEW']);
  await page.goto('./inventario/control?view=counts');
  const workspace = page.locator('ui-inventory-operations-page');
  await expect(page.getByRole('button', { name: 'Nueva sesión' })).toHaveCount(0);
  await workspace.getByRole('button', { name: 'Importación' }).click();
  await expect(page.getByText('No tienes permiso para importar')).toBeVisible();
  await expect(page.locator('input[type=file]')).toBeDisabled();
  await workspace.getByRole('button', { name: 'Alertas' }).click();
  await expect(page.getByLabel('Nuevo umbral')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Revisar stock/ })).toBeVisible();
});
