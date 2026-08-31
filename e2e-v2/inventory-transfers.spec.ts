import { expect, test, type Page, type Route } from '@playwright/test';

const transferId = '11111111-1111-4111-8111-111111111111';
const lineId = '22222222-2222-4222-8222-222222222222';
const productId = '33333333-3333-4333-8333-333333333333';
const originWarehouseId = '44444444-4444-4444-8444-444444444444';
const destinationWarehouseId = '55555555-5555-4555-8555-555555555555';
const sourceLocationId = '66666666-6666-4666-8666-666666666666';
const destinationLocationId = '77777777-7777-4777-8777-777777777777';

type TransferStatus = 'DRAFT' | 'DISPATCHED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

function session(permissions: string[], destinationContext = false) {
  return {
    data: {
      user: { id: 'user-1', email: 'almacen@example.com', roles: ['ADMIN'], permissions },
      tenant: { id: 'tenant-1', name: 'Café Central' },
      context: {
        branch: destinationContext
          ? { id: 'branch-destination', name: 'Norte' }
          : { id: 'branch-origin', name: 'Centro' },
        warehouse: destinationContext
          ? { id: destinationWarehouseId, name: 'Bodega Norte' }
          : { id: originWarehouseId, name: 'Bodega Centro' },
        cashRegister: null,
      },
      nextStep: 'APPLICATION',
    },
    meta: { apiVersion: '1', sessionExpiresAt: '2026-08-31T03:00:00.000Z' },
  };
}

const branches = [
  {
    id: 'branch-origin',
    name: 'Centro',
    active: true,
    warehouses: [
      {
        id: originWarehouseId,
        name: 'Bodega Centro',
        active: true,
        locations: [
          { id: sourceLocationId, name: 'Disponible Centro', code: 'CEN-01', active: true },
        ],
      },
    ],
  },
  {
    id: 'branch-destination',
    name: 'Norte',
    active: true,
    warehouses: [
      {
        id: destinationWarehouseId,
        name: 'Bodega Norte',
        active: true,
        locations: [
          { id: destinationLocationId, name: 'Recepción Norte', code: 'NOR-01', active: true },
        ],
      },
    ],
  },
];

function transfer(status: TransferStatus = 'DRAFT', received = '0.000', difference = '0.000') {
  const pending = Math.max(0, 5 - Number(received) - Number(difference)).toFixed(3);
  return {
    id: transferId,
    status,
    reference: 'TR-2026-001',
    reason: 'Reabastecimiento semanal',
    originWarehouse: {
      id: originWarehouseId,
      name: 'Bodega Centro',
      branch: { id: 'branch-origin', name: 'Centro' },
    },
    destinationWarehouse: {
      id: destinationWarehouseId,
      name: 'Bodega Norte',
      branch: { id: 'branch-destination', name: 'Norte' },
    },
    lines: [
      {
        id: lineId,
        lineNumber: 1,
        product: { id: productId, name: 'Café de altura', sku: 'CAF-ALT-01' },
        sourceLocation: { id: sourceLocationId, name: 'Disponible Centro', code: 'CEN-01' },
        destinationLocation: {
          id: destinationLocationId,
          name: 'Recepción Norte',
          code: 'NOR-01',
        },
        quantity: '5.000',
        receivedQuantity: received,
        discrepancyQuantity: difference,
        pendingQuantity: pending,
        serialNumbers: [],
      },
    ],
    receipts: [] as unknown[],
    createdBy: { id: 'user-1', email: 'almacen@example.com' },
    dispatchedBy:
      status === 'DRAFT' || status === 'CANCELLED'
        ? null
        : { id: 'approver-1', email: 'supervisor@example.com' },
    cancelledBy:
      status === 'CANCELLED' ? { id: 'approver-1', email: 'supervisor@example.com' } : null,
    createdAt: '2026-08-30T20:00:00.000Z',
    dispatchedAt: status === 'DRAFT' || status === 'CANCELLED' ? null : '2026-08-30T20:05:00.000Z',
    cancelledAt: status === 'CANCELLED' ? '2026-08-30T20:03:00.000Z' : null,
  };
}

async function json(route: Route, data: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
}

async function mockTransfers(
  page: Page,
  permissions: string[],
  initial: TransferStatus | 'EMPTY' = 'DRAFT',
) {
  let current = initial === 'EMPTY' ? null : transfer(initial);
  const destinationContext = ['DISPATCHED', 'PARTIALLY_RECEIVED', 'RECEIVED'].includes(initial);
  let dispatchAttempts = 0;
  const writes: { path: string; key?: string; body?: unknown }[] = [];

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    const method = request.method();
    const key = request.headers()['idempotency-key'];
    if (path === '/auth/sessions/current') {
      return json(route, session(permissions, destinationContext));
    }
    if (path === '/organization/branches') {
      return json(route, { data: branches, meta: { apiVersion: '1' } });
    }
    if (path === '/inventory/stock') {
      return json(route, {
        data: [
          {
            product: { id: productId, name: 'Café de altura', sku: 'CAF-ALT-01' },
            totalQuantity: '12.000',
          },
        ],
        meta: { pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 } },
      });
    }
    if (path === '/inventory/transfers' && method === 'GET') {
      return json(route, { data: current ? [current] : [], meta: { apiVersion: '1' } });
    }
    if (path === '/inventory/transfers' && method === 'POST') {
      writes.push({ path, key, body: request.postDataJSON() });
      current = transfer('DRAFT');
      return json(
        route,
        { data: current, meta: { apiVersion: '1', idempotentReplay: false } },
        201,
      );
    }
    if (path === `/inventory/transfers/${transferId}` && method === 'GET') {
      return json(route, { data: current, meta: { apiVersion: '1' } });
    }
    if (path === `/inventory/transfers/${transferId}/dispatch` && method === 'POST') {
      writes.push({ path, key });
      dispatchAttempts += 1;
      if (dispatchAttempts === 1) {
        return json(route, { code: 'TEMPORARY_FAILURE', message: 'Despacho interrumpido.' }, 503);
      }
      current = transfer('DISPATCHED');
      return json(route, {
        data: current,
        meta: { apiVersion: '1', idempotentReplay: true },
      });
    }
    if (path === `/inventory/transfers/${transferId}/receipts` && method === 'POST') {
      const body = request.postDataJSON() as {
        discrepancyReason?: string;
        lines: { receivedQuantity: string; discrepancyQuantity: string }[];
      };
      writes.push({ path, key, body });
      const previousReceived = Number(current?.lines[0].receivedQuantity ?? 0);
      const previousDifference = Number(current?.lines[0].discrepancyQuantity ?? 0);
      const received = previousReceived + Number(body.lines[0].receivedQuantity);
      const difference = previousDifference + Number(body.lines[0].discrepancyQuantity);
      const status = received + difference === 5 ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
      const updated = transfer(status, received.toFixed(3), difference.toFixed(3));
      updated.receipts = [
        {
          id: `receipt-${writes.length}`,
          discrepancyReason: body.discrepancyReason ?? null,
          receivedBy: { id: 'user-1', email: 'almacen@example.com' },
          createdAt: '2026-08-30T20:10:00.000Z',
          lines: [
            {
              id: `receipt-line-${writes.length}`,
              lineNumber: 1,
              transferLineId: lineId,
              product: updated.lines[0].product,
              receivedQuantity: body.lines[0].receivedQuantity,
              discrepancyQuantity: body.lines[0].discrepancyQuantity,
            },
          ],
        },
      ];
      current = updated;
      return json(route, {
        data: current,
        meta: { apiVersion: '1', idempotentReplay: false },
      });
    }
    if (path === `/inventory/transfers/${transferId}/cancel` && method === 'POST') {
      writes.push({ path });
      current = transfer('CANCELLED');
      return json(route, { data: current, meta: { apiVersion: '1' } });
    }
    return json(route, { message: `Unhandled ${method} ${path}` }, 404);
  });
  return { writes, current: () => current };
}

test('creates an explicit route and dispatches stock idempotently', async ({ page }, testInfo) => {
  const state = await mockTransfers(
    page,
    ['INVENTORY_VIEW', 'INVENTORY_TRANSFER', 'INVENTORY_APPROVE'],
    'EMPTY',
  );
  await page.goto('./inventario/transferencias');
  await page.getByRole('button', { name: 'Nueva transferencia' }).click();
  await expect(page.getByText('Bodega Centro', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('option', { name: 'Norte · Bodega Norte' })).toBeAttached();
  await page.getByLabel('Referencia').fill('TR-2026-001');
  await page.getByLabel('Motivo').fill('Reabastecimiento semanal');
  await page.getByRole('button', { name: /Café de altura/ }).click();
  await page.getByLabel('Cantidad').fill('5.000');
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  const create = state.writes.find(({ path }) => path === '/inventory/transfers');
  expect(create?.body).toMatchObject({
    destinationWarehouseId,
    lines: [{ productId, sourceLocationId, destinationLocationId, quantity: '5.000' }],
  });
  await page.getByRole('button', { name: 'Aprobar y despachar' }).click();
  await expect(page.getByText(/saldrán del disponible de Bodega Centro/)).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar despacho' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'stock quedó en tránsito' }),
  ).toBeVisible();
  const dispatches = state.writes.filter(({ path }) => path.endsWith('/dispatch'));
  expect(dispatches).toHaveLength(2);
  expect(dispatches[0].key).toBe(dispatches[1].key);
  await page.screenshot({
    path: testInfo.outputPath(`transfer-dispatched-${testInfo.project.name}.png`),
    fullPage: true,
  });
});

test('records partial receipt, discrepancy and remaining in-transit stock', async ({ page }) => {
  const state = await mockTransfers(page, ['INVENTORY_VIEW', 'INVENTORY_TRANSFER'], 'DISPATCHED');
  await page.goto('./inventario/transferencias');
  await page.getByRole('button', { name: /TR-2026-001/ }).click();
  await page.getByRole('button', { name: 'Registrar recepción' }).click();
  await page.getByLabel('Recibido').fill('3.000');
  await page.getByLabel('Diferencia', { exact: true }).fill('1.000');
  await page.getByLabel(/Motivo de diferencia/).fill('Una unidad dañada en tránsito');
  await page.getByRole('button', { name: 'Confirmar recepción' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'remanente continúa en tránsito' }),
  ).toBeVisible();
  const receipt = state.writes.find(({ path }) => path.endsWith('/receipts'));
  expect(receipt?.body).toMatchObject({
    discrepancyReason: 'Una unidad dañada en tránsito',
    lines: [{ transferLineId: lineId, receivedQuantity: '3.000', discrepancyQuantity: '1.000' }],
  });
  expect(receipt?.key).toMatch(/^web-transfer-receipt-/);
  await expect(
    page.locator('ui-transfer-detail-panel .status').filter({ hasText: 'Recepción parcial' }),
  ).toBeVisible();
  await expect(page.getByText('Una unidad dañada en tránsito')).toBeVisible();
});

test('cancels a draft without stock impact and respects read-only permissions on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await mockTransfers(page, ['INVENTORY_VIEW', 'INVENTORY_APPROVE'], 'DRAFT');
  await page.goto('./inventario/transferencias');
  await expect(page.getByRole('button', { name: 'Nueva transferencia' })).toHaveCount(0);
  await page.getByRole('button', { name: /TR-2026-001/ }).click();
  await expect(page.getByRole('button', { name: 'Registrar recepción' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancelar borrador' }).click();
  await expect(page.getByText('Sin movimiento de stock', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar borrador' }).last().click();
  await expect(
    page.getByRole('status').filter({ hasText: 'No hubo movimiento de inventario' }),
  ).toBeVisible();
  expect(state.current()?.status).toBe('CANCELLED');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  expect(overflow).toBe(false);
});
