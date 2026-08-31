import { expect, test } from '@playwright/test';
import type { Page, Route, TestInfo } from '@playwright/test';

const product = {
  id: '11111111-1111-4111-8111-111111111111',
  tenantId: '22222222-2222-4222-8222-222222222222',
  version: 1,
  updatedAt: '2026-08-31T03:00:00.000Z',
  kind: 'PRODUCT',
  name: 'Café offline',
  sku: 'OFF-001',
  barcode: '750100000001',
  categoryId: null,
  brandId: null,
  price: '100.00',
  baseUnit: 'UNIT',
  quantityPrecision: 3,
  minimumQuantity: '0.001',
  active: true,
};

const branch = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Centro',
  timezone: 'America/Mexico_City',
  active: true,
  warehouses: [
    {
      id: '44444444-4444-4444-8444-444444444444',
      name: 'Principal',
      active: true,
      locations: [
        {
          id: '55555555-5555-4555-8555-555555555555',
          name: 'General',
          code: 'GENERAL',
          active: true,
        },
      ],
    },
  ],
  cashRegisters: [
    {
      id: '66666666-6666-4666-8666-666666666666',
      name: 'Caja 1',
      code: 'CAJA-01',
    },
  ],
};

interface MockState {
  offline: boolean;
  conflict: boolean;
  scope?: Record<string, string | null>;
  readonly batches: Array<Array<Record<string, unknown>>>;
}

test('prepares, operates, synchronizes and resolves conflicts without silent loss', async ({
  page,
}, testInfo) => {
  const state: MockState = { offline: false, conflict: true, batches: [] };
  await mockOfflineFlow(page, state);
  await page.goto('./ventas/pos');

  await expect(page.getByRole('region', { name: 'Venta rápida' })).toBeVisible();
  await page.getByRole('button', { name: /Estado offline:/ }).click();
  const center = page.getByRole('dialog', { name: 'Trabajo sin conexión' });
  await center.getByRole('button', { name: 'Preparar offline' }).click();
  await expect(center.getByText('4', { exact: true })).toBeVisible();
  await center.getByRole('button', { name: 'Cerrar estado offline' }).click();

  state.offline = true;
  await page.reload();
  await expect(page.getByRole('region', { name: 'Venta rápida' })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  const search = page.getByLabel('Buscar o escanear producto');
  await search.fill('offline');
  await expect(page.getByRole('button', { name: 'Agregar Café offline' })).toBeVisible();
  await page.getByRole('button', { name: 'Agregar Café offline' }).click();
  await expect(page.getByText('Disponible 5.000')).toBeVisible();

  await page.getByRole('button', { name: 'Continuar al cobro' }).click();
  const checkout = page.getByRole('dialog', { name: 'Completar venta' });
  await checkout.getByLabel('Efectivo recibido').fill('150');
  await checkout.getByRole('button', { name: 'Cobrar y completar venta' }).click();
  await expect(page.getByRole('dialog', { name: 'PEND-1' })).toContainText(
    'Venta guardada para sincronizar',
  );
  await page.getByRole('button', { name: 'Iniciar otra venta' }).click();
  await expect(page.getByRole('button', { name: 'Estado offline: Sin conexión' })).toContainText(
    '1',
  );

  state.offline = false;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByRole('button', { name: 'Estado offline: Conflictos' })).toBeVisible();
  await page.getByRole('button', { name: 'Estado offline: Conflictos' }).click();
  await expect(center.getByText('Revisión necesaria')).toBeVisible();
  await expect(center.getByText('Revisa el stock y vuelve a intentar.')).toBeVisible();
  await captureVisual(page, testInfo);

  state.conflict = false;
  await center.getByRole('button', { name: 'Sincronizar y reintentar' }).click();
  await expect(center.getByText('No hay operaciones pendientes.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Estado offline: En línea' })).toBeVisible();

  expect(state.batches).toHaveLength(2);
  const first = state.batches[0]![0]!;
  const retried = state.batches[1]![0]!;
  expect(first['sequence']).toBe(1);
  expect(retried['sequence']).toBe(2);
  expect(retried['commandId']).not.toBe(first['commandId']);
  expect(retried['idempotencyKey']).not.toBe(first['idempotencyKey']);
  expect(retried['payload']).toEqual(first['payload']);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
});

async function mockOfflineFlow(page: Page, state: MockState): Promise<void> {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');
    const method = route.request().method();
    if (path === '/auth/sessions/current') {
      return state.offline ? route.abort('internetdisconnected') : json(route, session());
    }
    if (path === '/organization/branches') {
      if (state.offline) return route.abort('internetdisconnected');
      return json(route, { data: [branch], meta: { apiVersion: '1' } });
    }
    if (path === '/offline/bootstrap') {
      const deviceId = url.searchParams.get('deviceId')!;
      state.scope = {
        tenantId: product.tenantId,
        userId: '77777777-7777-4777-8777-777777777777',
        deviceId,
        branchId: branch.id,
        cashRegisterId: branch.cashRegisters[0].id,
      };
      return json(route, { data: bootstrap(state.scope) });
    }
    if (path === '/offline/commands/batch' && method === 'POST') {
      const commands = (
        route.request().postDataJSON() as { commands: Array<Record<string, unknown>> }
      ).commands;
      state.batches.push(commands);
      return json(route, {
        data: {
          results: commands.map((command) =>
            state.conflict
              ? {
                  commandId: command['commandId'],
                  sequence: command['sequence'],
                  status: 'ERROR',
                  replay: false,
                  error: {
                    status: 409,
                    details: {
                      code: 'OFFLINE_COMMAND_STALE',
                      message: 'La venta requiere revisión.',
                    },
                    conflict: {
                      domain: 'STOCK',
                      strategy: 'REVIEW',
                      userAction: 'Revisa el stock y vuelve a intentar.',
                    },
                  },
                }
              : {
                  commandId: command['commandId'],
                  sequence: command['sequence'],
                  status: 'CONFIRMED',
                  replay: false,
                },
          ),
        },
        meta: { apiVersion: '1' },
      });
    }
    if (path === '/offline/changes') {
      return json(route, {
        data: {
          generatedAt: new Date().toISOString(),
          sessionExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          freshnessPolicy: freshness(),
          scope: state.scope,
          identity: {
            user: {
              id: '77777777-7777-4777-8777-777777777777',
              roles: ['ADMIN'],
              permissions: ['SALES_MANAGE', 'INVENTORY_VIEW', 'INVENTORY_ADJUST'],
            },
          },
          nextCursor: 'sync-cursor-2',
          hasMore: false,
          changes: [],
        },
      });
    }
    if (
      state.offline &&
      ((path === '/products' && method === 'GET') ||
        path === '/products/resolve-code' ||
        path === '/pos/register-shifts/current' ||
        path === '/pos/cart/quote' ||
        path === '/pos/payment-options' ||
        path === '/pos/sales/cash')
    ) {
      return route.abort('internetdisconnected');
    }
    if (path === '/pos/register-shifts/current') {
      return json(route, {
        data: {
          id: '88888888-8888-4888-8888-888888888888',
          status: 'OPEN',
          branch: { id: branch.id, name: branch.name },
          cashRegister: branch.cashRegisters[0],
          openedBy: { id: '77777777-7777-4777-8777-777777777777', email: 'admin@example.com' },
          openingAmount: '100.00',
          currency: 'MXN',
          openedAt: new Date().toISOString(),
        },
        meta: { apiVersion: '1' },
      });
    }
    if (path === '/products' && method === 'GET') {
      return json(route, {
        data: [],
        meta: { pagination: { page: 1, pageSize: 24, total: 0, totalPages: 0 } },
      });
    }
    throw new Error(`Request no simulada: ${method} ${path}`);
  });
}

function session() {
  return {
    data: {
      user: {
        id: '77777777-7777-4777-8777-777777777777',
        email: 'admin@example.com',
        roles: ['ADMIN'],
        permissions: ['SALES_MANAGE', 'INVENTORY_VIEW', 'INVENTORY_ADJUST'],
      },
      tenant: { id: product.tenantId, name: 'Tienda Central' },
      context: {
        branch: { id: branch.id, name: branch.name },
        warehouse: { id: branch.warehouses[0].id, name: branch.warehouses[0].name },
        cashRegister: branch.cashRegisters[0],
      },
      nextStep: 'APPLICATION',
    },
    meta: { apiVersion: '1', sessionExpiresAt: new Date(Date.now() + 3_600_000).toISOString() },
  };
}

function bootstrap(scope: Record<string, string | null>) {
  const generatedAt = new Date().toISOString();
  const base = { tenantId: product.tenantId, version: 1, updatedAt: generatedAt };
  return {
    protocolVersion: '1.0',
    generatedAt,
    sessionExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    freshnessPolicy: freshness(),
    scope,
    identity: {
      tenant: { id: product.tenantId, name: 'Tienda Central' },
      user: {
        id: '77777777-7777-4777-8777-777777777777',
        roles: ['ADMIN'],
        permissions: ['SALES_MANAGE', 'INVENTORY_VIEW', 'INVENTORY_ADJUST'],
      },
    },
    valuationPolicy: { method: 'MOVING_AVERAGE', version: 1 },
    posPolicy: {
      ...base,
      kind: 'POS_POLICY',
      id: '99999999-9999-4999-8999-999999999999',
      branchId: branch.id,
      warehouseId: branch.warehouses[0].id,
      cashRegisterId: branch.cashRegisters[0].id,
      shiftId: '88888888-8888-4888-8888-888888888888',
      shiftOpenedAt: generatedAt,
      currency: 'MXN',
      taxRate: '0.1600',
      paymentMethods: ['CASH'],
      negativeStock: 'DENY',
    },
    page: {
      initialSyncCursor: 'sync-cursor-1',
      cursor: 'bootstrap-1',
      nextCursor: null,
      complete: true,
      entities: [
        product,
        {
          ...base,
          kind: 'LOCATION',
          id: branch.warehouses[0].locations[0].id,
          warehouseId: branch.warehouses[0].id,
          name: 'General',
          code: 'GENERAL',
          active: true,
        },
        {
          ...base,
          kind: 'INVENTORY_AVAILABILITY',
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          productId: product.id,
          locationId: branch.warehouses[0].locations[0].id,
          availableQuantity: '5.000',
        },
      ],
    },
  };
}

function freshness() {
  return {
    version: 1,
    maxClockSkewSeconds: 300,
    catalogTtlSeconds: 86_400,
    permissionsTtlSeconds: 3_600,
    actionTtlSeconds: { CASH_SALE: 900, INVENTORY_COUNT: 14_400, INVENTORY_MOVEMENT: 3_600 },
  };
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function captureVisual(page: Page, testInfo: TestInfo): Promise<void> {
  await page.screenshot({
    path: testInfo.outputPath(`uin-202-conflict-${testInfo.project.name}.png`),
    fullPage: true,
  });
}
