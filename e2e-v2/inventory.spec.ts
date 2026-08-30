import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

const branch = {
  id: 'branch-1',
  name: 'Centro',
  timezone: 'America/Mexico_City',
  active: true,
  warehouses: [{ id: 'warehouse-1', name: 'Principal', active: true, locations: [] }],
  cashRegisters: [{ id: 'register-1', name: 'Caja 1', code: 'CAJA-01' }],
};

const location = { id: 'location-1', name: 'Piso de venta', code: 'PISO' };

function session(permissions = ['INVENTORY_VIEW', 'INVENTORY_ADJUST']) {
  return {
    data: {
      user: { id: 'user-1', email: 'admin@example.com', roles: ['ADMIN'], permissions },
      tenant: { id: 'tenant-1', name: 'Tienda Central' },
      context: {
        branch: { id: branch.id, name: branch.name },
        warehouse: { id: 'warehouse-1', name: 'Principal' },
        cashRegister: { id: 'register-1', name: 'Caja 1', code: 'CAJA-01' },
      },
      nextStep: 'APPLICATION',
    },
    meta: { apiVersion: '1', sessionExpiresAt: new Date(Date.now() + 3_600_000).toISOString() },
  };
}

function stock(available = '12.000', damaged = '0.000') {
  return {
    product: {
      id: 'product-1',
      name: 'Café molido',
      sku: 'CAFE-01',
      active: true,
      trackLots: false,
      baseUnit: 'UNIT',
      quantityPrecision: 0,
      minimumQuantity: '2.000',
    },
    availableQuantity: available,
    totalQuantity: String((Number(available) + Number(damaged)).toFixed(3)),
    states: [
      { code: 'AVAILABLE', quantity: available },
      { code: 'RESERVED', quantity: '0.000' },
      { code: 'DAMAGED', quantity: damaged },
      { code: 'IN_TRANSIT', quantity: '0.000' },
    ],
    averageUnitCost: '80.0000',
    inventoryValue: '960.0000',
    costing: { method: 'MOVING_AVERAGE', currency: 'MXN', reconciled: true },
  };
}

function stockResponse(item = stock()) {
  return {
    data: [item],
    meta: {
      apiVersion: '1',
      scope: {
        branch: { id: branch.id, name: branch.name },
        warehouse: { id: 'warehouse-1', name: 'Principal' },
      },
      valuation: { currency: 'MXN' },
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    },
  };
}

function productDetails() {
  return {
    data: {
      id: 'product-1',
      name: 'Café molido',
      sku: 'CAFE-01',
      active: true,
      trackLots: false,
      trackSerials: false,
      baseUnit: 'UNIT',
      quantityPrecision: 0,
    },
    meta: { apiVersion: '1' },
  };
}

function movement(overrides: Record<string, unknown> = {}) {
  return {
    id: 'movement-1',
    type: 'ENTRY',
    direction: 'IN',
    quantityChange: '3.000',
    previousQuantity: '12.000',
    resultingQuantity: '15.000',
    reason: 'Recepción manual',
    reference: 'DOC-42',
    createdAt: '2026-08-30T15:00:00.000Z',
    product: { id: 'product-1', name: 'Café molido', sku: 'CAFE-01' },
    location: {
      ...location,
      warehouse: { id: 'warehouse-1', name: 'Principal' },
    },
    responsible: { id: 'user-1', email: 'admin@example.com' },
    stateTransition: null,
    ...overrides,
  };
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockBase(
  page: Page,
  handler: (route: Route, path: string, url: URL) => Promise<boolean>,
  permissions?: string[],
): Promise<void> {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');
    if (await handler(route, path, url)) return;
    if (path === '/auth/sessions/current') return json(route, session(permissions));
    if (path === '/organization/branches')
      return json(route, { data: [branch], meta: { apiVersion: '1' } });
    if (path === '/inventory/locations')
      return json(route, { data: [location], meta: { apiVersion: '1' } });
    throw new Error(`Request no simulada: ${route.request().method()} ${path}`);
  });
}

test('keeps stock read-only and filters products on the server', async ({ page }) => {
  let stockQuery = '';
  await mockBase(
    page,
    async (route, path, url) => {
      if (path !== '/inventory/stock') return false;
      stockQuery = url.search;
      await json(route, stockResponse());
      return true;
    },
    ['INVENTORY_VIEW'],
  );

  await page.goto('./inventario');
  await expect(page.getByText('Café molido', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Registrar movimiento' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Movimiento' })).toHaveCount(0);

  await page.getByLabel('Buscar existencias').fill('café');
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(page).toHaveURL(/q=caf(%C3%A9|é)/);
  expect(stockQuery).toContain('q=caf');
  expect(stockQuery).toContain('pageSize=20');
});

test('registers a movement and a state transition, then refreshes balances', async ({ page }) => {
  let currentStock = stock();
  const writes: Array<{ path: string; body: Record<string, unknown>; idempotency: string | null }> =
    [];
  await mockBase(page, async (route, path) => {
    const method = route.request().method();
    if (path === '/inventory/stock' && method === 'GET') {
      await json(route, stockResponse(currentStock));
      return true;
    }
    if (path === '/products/product-1' && method === 'GET') {
      await json(route, productDetails());
      return true;
    }
    if (path === '/inventory/movements' && method === 'POST') {
      writes.push({
        path,
        body: route.request().postDataJSON() as Record<string, unknown>,
        idempotency: route.request().headers()['idempotency-key'] ?? null,
      });
      currentStock = stock('15.000');
      await json(route, { data: movement(), meta: { apiVersion: '1', idempotentReplay: false } });
      return true;
    }
    if (path === '/inventory/state-transitions' && method === 'POST') {
      writes.push({
        path,
        body: route.request().postDataJSON() as Record<string, unknown>,
        idempotency: route.request().headers()['idempotency-key'] ?? null,
      });
      currentStock = stock('14.000', '1.000');
      await json(route, {
        data: movement({
          id: 'movement-2',
          type: 'STATE_TRANSITION',
          quantityChange: '0.000',
          stateTransition: { from: 'AVAILABLE', to: 'DAMAGED', quantity: '1.000' },
        }),
        meta: { apiVersion: '1', idempotentReplay: false },
      });
      return true;
    }
    return false;
  });

  await page.goto('./inventario');
  await page.getByRole('button', { name: 'Registrar movimiento' }).click();
  await expect(page.getByRole('dialog', { name: 'Selecciona un producto' })).toBeVisible();
  await page
    .getByRole('dialog', { name: 'Selecciona un producto' })
    .getByText('Café molido')
    .click();
  const movementDialog = page.getByRole('dialog', { name: 'Café molido' });
  await movementDialog.getByLabel('Cantidad').fill('3');
  await movementDialog.getByLabel('Razón').fill('Recepción manual');
  await movementDialog.getByLabel('Referencia o evidencia').fill('DOC-42');
  await movementDialog.getByRole('button', { name: 'Registrar movimiento' }).click();
  await expect(page.getByText('Movimiento registrado. El saldo fue actualizado.')).toBeVisible();
  await expect(page.getByText('15.000', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Cambiar estado de Café molido' }).click();
  const stateDialog = page.getByRole('dialog', { name: 'Café molido' });
  await stateDialog.getByLabel('Hacia').selectOption('DAMAGED');
  await stateDialog.getByLabel('Cantidad').fill('1');
  await stateDialog.getByLabel('Razón').fill('Daño detectado');
  await stateDialog.getByLabel('Referencia o evidencia').fill('QA-9');
  await stateDialog.getByRole('button', { name: 'Cambiar estado' }).click();
  await expect(page.getByText('Estado actualizado. El total físico se conserva.')).toBeVisible();
  await expect(page.getByText('Dañado 1.000')).toBeVisible();

  expect(writes).toHaveLength(2);
  expect(writes[0].body).toMatchObject({
    productId: 'product-1',
    locationId: 'location-1',
    type: 'ENTRY',
    quantity: '3',
    reason: 'Recepción manual',
    reference: 'DOC-42',
  });
  expect(writes[1].body).toMatchObject({
    fromState: 'AVAILABLE',
    toState: 'DAMAGED',
    quantity: '1',
    reference: 'QA-9',
  });
  expect(writes.every(({ idempotency }) => idempotency?.startsWith('web-'))).toBe(true);
});

test('filters and paginates movement history without loading the catalog', async ({ page }) => {
  const movementQueries: string[] = [];
  let catalogListCalls = 0;
  await mockBase(page, async (route, path, url) => {
    if (path === '/inventory/stock') {
      await json(route, stockResponse());
      return true;
    }
    if (path === '/products') {
      catalogListCalls += 1;
      return true;
    }
    if (path === '/inventory/movements') {
      movementQueries.push(url.search);
      await json(route, {
        data: [movement()],
        meta: {
          apiVersion: '1',
          scope: { branch: { id: branch.id, name: branch.name } },
          pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        },
      });
      return true;
    }
    return false;
  });

  await page.goto('./inventario');
  await page.getByRole('button', { name: 'Historial' }).click();
  await expect(page.getByText('Recepción manual')).toBeVisible();
  await page.getByLabel('Buscar movimientos').fill('café');
  await page.getByLabel('Tipo de movimiento').selectOption('ENTRY');
  await page.getByLabel('Fecha desde').fill('2026-08-01');
  await page.getByLabel('Fecha hasta').fill('2026-08-30');
  await page.getByRole('button', { name: 'Aplicar' }).click();

  await expect(page).toHaveURL(/view=movements/);
  await expect(page).toHaveURL(/type=ENTRY/);
  await expect(page).toHaveURL(/dateFrom=2026-08-01/);
  expect(movementQueries.at(-1)).toContain('q=caf');
  expect(movementQueries.at(-1)).toContain('type=ENTRY');
  expect(catalogListCalls).toBe(0);
});
