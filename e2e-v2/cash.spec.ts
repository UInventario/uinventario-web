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

const shift = () => ({
  id: 'shift-1',
  status: 'OPEN',
  branch: { id: branch.id, name: branch.name },
  cashRegister: branch.cashRegisters[0],
  openedBy: { id: 'user-1', email: 'cashier@example.com' },
  openingAmount: '250.00',
  currency: 'MXN',
  openedAt: '2026-08-30T15:00:00.000Z',
});

function session(permissions: string[]) {
  return {
    data: {
      user: { id: 'user-1', email: 'cashier@example.com', roles: ['CASHIER'], permissions },
      tenant: { id: 'tenant-1', name: 'Tienda Central' },
      context: {
        branch: { id: branch.id, name: branch.name },
        warehouse: { id: 'warehouse-1', name: 'Principal' },
        cashRegister: branch.cashRegisters[0],
      },
      nextStep: 'APPLICATION',
    },
    meta: { apiVersion: '1', sessionExpiresAt: new Date(Date.now() + 3_600_000).toISOString() },
  };
}

interface CashMock {
  readonly writes: Array<{ path: string; body: Record<string, unknown>; key: string | null }>;
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockCash(
  page: Page,
  options: { open?: boolean; permissions?: string[]; expected?: string } = {},
): Promise<CashMock> {
  const permissions = options.permissions ?? [
    'CASH_REGISTER_OPEN',
    'CASH_REGISTER_CLOSE',
    'CASH_REGISTER_MOVE',
    'SALES_MANAGE',
  ];
  let current = options.open === false ? null : shift();
  let expected = options.expected ?? (current ? current.openingAmount : '0.00');
  let latest: Record<string, unknown> | null = null;
  const movements: Array<Record<string, unknown>> = [];
  const writes: CashMock['writes'] = [];

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    const method = request.method();
    if (path === '/auth/sessions/current') return json(route, session(permissions));
    if (path === '/organization/branches') {
      return json(route, { data: [branch], meta: { apiVersion: '1' } });
    }
    if (path === '/pos/register-shifts/current' && method === 'GET') {
      return json(route, { data: current, meta: { apiVersion: '1' } });
    }
    if (path === '/pos/register-shifts/latest-closed') {
      return json(route, { data: latest, meta: { apiVersion: '1' } });
    }
    if (path === '/pos/register-shifts/current/movements' && method === 'GET') {
      return json(route, {
        data: movements,
        meta: { apiVersion: '1', shiftId: current?.id, currency: 'MXN', expectedCash: expected },
      });
    }

    const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
    writes.push({ path, body, key: request.headers()['idempotency-key'] ?? null });
    if (path === '/pos/register-shifts' && method === 'POST') {
      current = { ...shift(), openingAmount: String(body['openingAmount']) };
      expected = `${Number(body['openingAmount']).toFixed(2)}`;
      return json(
        route,
        { data: current, meta: { apiVersion: '1', idempotentReplay: false } },
        201,
      );
    }
    if (path === '/pos/register-shifts/current/movements' && method === 'POST') {
      const movement = {
        id: `movement-${movements.length + 1}`,
        type: body['type'],
        amount: Number(body['amount']).toFixed(2),
        reason: body['reason'],
        responsible: { id: 'user-1', email: 'cashier@example.com' },
        reversalOf: null,
        reversed: false,
        createdAt: '2026-08-30T16:00:00.000Z',
      };
      movements.unshift(movement);
      expected = (
        Number(expected) +
        (body['type'] === 'INCOME' ? Number(body['amount']) : -Number(body['amount']))
      ).toFixed(2);
      return json(
        route,
        {
          data: movement,
          meta: { apiVersion: '1', expectedCash: expected, idempotentReplay: false },
        },
        201,
      );
    }
    if (/\/movements\/[^/]+\/reversals$/.test(path)) {
      const movementId = path.split('/').at(-2)!;
      const original = movements.find((movement) => movement['id'] === movementId)!;
      original['reversed'] = true;
      const reversal = {
        id: `movement-${movements.length + 1}`,
        type: 'REVERSAL',
        amount: original['amount'],
        reason: body['reason'],
        responsible: { id: 'user-1', email: 'cashier@example.com' },
        reversalOf: { id: movementId, type: original['type'], reason: original['reason'] },
        reversed: false,
        createdAt: '2026-08-30T16:05:00.000Z',
      };
      movements.unshift(reversal);
      expected = (
        Number(expected) +
        (original['type'] === 'INCOME' ? -Number(original['amount']) : Number(original['amount']))
      ).toFixed(2);
      return json(
        route,
        {
          data: reversal,
          meta: { apiVersion: '1', expectedCash: expected, idempotentReplay: false },
        },
        201,
      );
    }
    if (path === '/pos/register-shifts/current/closure') {
      const counted = Number(body['countedAmount']);
      latest = {
        ...current,
        status: 'CLOSED',
        closedBy: { id: 'user-1', email: 'cashier@example.com' },
        salesCount: 1,
        cashSales: '119.90',
        movementsCount: movements.length,
        movementsNet: '0.00',
        expectedCash: expected,
        countedCash: counted.toFixed(2),
        difference: (counted - Number(expected)).toFixed(2),
        differenceReason: body['differenceReason'] ?? null,
        denominations: body['denominations'] ?? [],
        closedAt: '2026-08-30T17:00:00.000Z',
      };
      current = null;
      return json(route, { data: latest, meta: { apiVersion: '1', idempotentReplay: false } }, 201);
    }
    throw new Error(`Request no simulada: ${method} ${path}`);
  });
  return { writes };
}

test('opens a shift with a valid initial fund and an idempotency key', async ({ page }) => {
  const mock = await mockCash(page, { open: false });
  await page.goto('./ventas/caja');

  await expect(page.getByRole('heading', { name: 'Abre un turno para comenzar' })).toBeVisible();
  await page.getByLabel('Fondo inicial').fill('-1');
  await expect(page.getByRole('button', { name: 'Abrir turno' })).toBeDisabled();
  await page.getByLabel('Fondo inicial').fill('250.00');
  await page.getByRole('button', { name: 'Abrir turno' }).click();

  await expect(page.getByRole('region', { name: 'Turno abierto' })).toBeVisible();
  expect(mock.writes.at(-1)).toMatchObject({
    path: '/pos/register-shifts',
    body: { openingAmount: '250.00' },
  });
  expect(mock.writes.at(-1)?.key).toMatch(/^web-cash-open:/);
});

test('records an immutable movement and its explicit reversal', async ({ page }) => {
  const mock = await mockCash(page, { open: true });
  await page.goto('./ventas/caja');
  await page.getByRole('button', { name: 'Ingreso' }).click();
  await page.getByLabel('Monto').fill('50');
  await page.getByLabel('Motivo').fill('Fondo adicional');
  await page.getByRole('button', { name: 'Guardar movimiento' }).click();

  await expect(page.getByText('Fondo adicional')).toBeVisible();
  await expect(page.getByText('$300.00')).toBeVisible();
  await page.getByRole('button', { name: 'Reversar' }).click();
  await page.getByLabel('Motivo de la reversa').fill('Ingreso capturado por error');
  await page.getByRole('button', { name: 'Confirmar reversa' }).click();

  await expect(page.getByText('Ingreso capturado por error')).toBeVisible();
  await expect(page.getByText('Reversado')).toBeVisible();
  await expect(page.locator('.expected').getByText('$250.00')).toBeVisible();
  expect(mock.writes.map(({ path }) => path)).toEqual([
    '/pos/register-shifts/current/movements',
    '/pos/register-shifts/current/movements/movement-1/reversals',
  ]);
});

test('requires a reason for a difference and closes with denomination detail', async ({ page }) => {
  const mock = await mockCash(page, { open: true, expected: '399.90' });
  await page.goto('./ventas/caja');
  await page.getByRole('button', { name: 'Cerrar y arquear' }).click();
  const denominations = page.getByRole('group', { name: /Conteo por denominaciones/ });
  await denominations.getByLabel('$200.00').fill('2');
  await expect(page.getByText('$0.10')).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar turno' }).click();
  await expect(page.getByText('Explica el sobrante o faltante antes de cerrar.')).toBeVisible();
  await page.getByLabel('Motivo de la diferencia').fill('Sobrante verificado');
  await page.getByRole('button', { name: 'Cerrar turno' }).click();

  await expect(page.getByRole('heading', { name: 'Reporte de turno' })).toBeVisible();
  await expect(page.getByText('Sobrante verificado')).toBeVisible();
  expect(mock.writes.at(-1)?.body).toMatchObject({
    countedAmount: '400.00',
    differenceReason: 'Sobrante verificado',
    denominations: [{ denomination: '200.00', quantity: 2 }],
  });
});

test('disables movement actions without the corresponding permission', async ({ page }) => {
  await mockCash(page, { open: true, permissions: ['CASH_REGISTER_CLOSE'] });
  await page.goto('./ventas/caja');
  await expect(page.getByRole('button', { name: 'Ingreso' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Retiro' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Cerrar y arquear' })).toBeEnabled();
});
