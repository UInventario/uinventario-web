import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

const productId = '11111111-1111-4111-8111-111111111111';
const serialId = '22222222-2222-4222-8222-222222222222';
const location = { id: 'location-1', name: 'Piso de venta', code: 'PISO' };

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockTraceability(
  page: Page,
  movementWrites: Array<Record<string, unknown>>,
): Promise<void> {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');
    const method = route.request().method();
    if (path === '/auth/sessions/current') {
      await json(route, {
        data: {
          user: {
            id: 'user-1',
            email: 'admin@example.com',
            roles: ['ADMIN'],
            permissions: ['INVENTORY_VIEW', 'INVENTORY_ADJUST'],
          },
          tenant: { id: 'tenant-1', name: 'Tienda Central' },
          context: {
            branch: { id: 'branch-1', name: 'Centro' },
            warehouse: { id: 'warehouse-1', name: 'Principal' },
            cashRegister: { id: 'register-1', name: 'Caja 1', code: 'CAJA-01' },
          },
          nextStep: 'APPLICATION',
        },
        meta: {
          apiVersion: '1',
          sessionExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        },
      });
      return;
    }
    if (path === '/organization/branches') {
      await json(route, {
        data: [
          {
            id: 'branch-1',
            name: 'Centro',
            timezone: 'America/Mexico_City',
            active: true,
            warehouses: [{ id: 'warehouse-1', name: 'Principal', active: true, locations: [] }],
            cashRegisters: [{ id: 'register-1', name: 'Caja 1', code: 'CAJA-01' }],
          },
        ],
        meta: { apiVersion: '1' },
      });
      return;
    }
    if (path === '/inventory/locations') {
      await json(route, { data: [location], meta: { apiVersion: '1' } });
      return;
    }
    if (path === '/inventory/stock') {
      await json(route, {
        data: [
          {
            product: {
              id: productId,
              name: 'Vacuna controlada',
              sku: 'VAC-01',
              active: true,
              trackLots: true,
              baseUnit: 'UNIT',
              quantityPrecision: 0,
              minimumQuantity: '1.000',
            },
            availableQuantity: '2.000',
            totalQuantity: '2.000',
            states: [],
            averageUnitCost: '50.00',
            inventoryValue: '100.00',
            costing: { method: 'SPECIFIC_LOT', currency: 'MXN', reconciled: true },
          },
        ],
        meta: {
          apiVersion: '1',
          scope: {
            branch: { id: 'branch-1', name: 'Centro' },
            warehouse: { id: 'warehouse-1', name: 'Principal' },
          },
          valuation: { currency: 'MXN' },
          pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
        },
      });
      return;
    }
    if (path === `/products/${productId}`) {
      await json(route, {
        data: {
          id: productId,
          name: 'Vacuna controlada',
          sku: 'VAC-01',
          active: true,
          trackLots: true,
          trackSerials: true,
          baseUnit: 'UNIT',
          quantityPrecision: 0,
        },
        meta: { apiVersion: '1' },
      });
      return;
    }
    if (path === '/inventory/lot-expiration-alerts') {
      await json(route, {
        data: [
          {
            id: 'lot-1:location-1',
            status: 'EXPIRED',
            product: { id: productId, name: 'Vacuna controlada', sku: 'VAC-01' },
            lot: { id: 'lot-1', code: 'LOT-ANT', expiresOn: '2026-08-01' },
            location,
            quantity: '1.000',
            daysUntilExpiration: -30,
          },
        ],
        meta: { apiVersion: '1', businessDate: '2026-08-31' },
      });
      return;
    }
    if (path === `/inventory/products/${productId}/lots`) {
      await json(route, {
        data: [
          {
            id: 'lot-1',
            code: 'LOT-ANT',
            product: { id: productId, name: 'Vacuna controlada', sku: 'VAC-01' },
            quantity: '1.000',
            unitCost: '50.00',
            currency: 'MXN',
            inventoryValue: '50.00',
            manufacturedOn: '2025-08-01',
            expiresOn: '2026-08-01',
            expirationStatus: 'EXPIRED',
            daysUntilExpiration: -30,
            createdAt: '2026-01-01T00:00:00.000Z',
            origins: [
              {
                purchaseReceiptLineId: 'receipt-line-1',
                quantity: '2.000',
                unitCost: '50.00',
                currency: 'MXN',
                receipt: { id: 'receipt-1', documentReference: 'FAC-100' },
                purchaseOrder: { id: 'order-1', folio: 'OC-100' },
              },
            ],
            balances: [{ location, quantity: '1.000' }],
          },
        ],
        meta: {
          apiVersion: '1',
          tracked: true,
          totalQuantity: '2.000',
          lotQuantity: '2.000',
          reconciled: true,
          currency: 'MXN',
          inventoryValue: '100.00',
        },
      });
      return;
    }
    if (path === `/inventory/products/${productId}/serials`) {
      await json(route, {
        data: [
          {
            id: serialId,
            serialNumber: 'SN-VAC-001',
            status: 'AVAILABLE',
            product: { id: productId, name: 'Vacuna controlada', sku: 'VAC-01' },
            currentLocation: location,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-08-30T12:00:00.000Z',
          },
        ],
        meta: { apiVersion: '1', tracked: true },
      });
      return;
    }
    if (path === `/inventory/serials/${serialId}/history`) {
      await json(route, {
        data: {
          serial: {
            id: serialId,
            serialNumber: 'SN-VAC-001',
            status: 'AVAILABLE',
            product: { id: productId, name: 'Vacuna controlada', sku: 'VAC-01' },
            currentLocation: location,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-08-30T12:00:00.000Z',
          },
          events: [
            {
              id: 'event-1',
              movement: {
                id: 'movement-1',
                type: 'PURCHASE_RECEIPT',
                reference: 'FAC-100',
                reason: 'Recepción de proveedor',
              },
              fromStatus: null,
              toStatus: 'AVAILABLE',
              fromLocation: null,
              toLocation: location,
              responsible: { id: 'user-1', email: 'admin@example.com' },
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        meta: { apiVersion: '1' },
      });
      return;
    }
    if (path === '/inventory/movements' && method === 'POST') {
      movementWrites.push(route.request().postDataJSON() as Record<string, unknown>);
      await json(route, {
        data: { id: 'movement-new' },
        meta: { apiVersion: '1', idempotentReplay: false },
      });
      return;
    }
    throw new Error(`Request no simulada: ${method} ${path}`);
  });
}

test('traces lot origin, expiration, serial route and registers controlled stock', async ({
  page,
}) => {
  const writes: Array<Record<string, unknown>> = [];
  await mockTraceability(page, writes);
  await page.goto('./inventario/trazabilidad');

  await expect(page.getByRole('heading', { name: 'Lotes, series y vencimientos' })).toBeVisible();
  await expect(page.getByText('30 días vencido')).toBeVisible();
  await page
    .locator('.product-picker')
    .getByRole('button', { name: /Vacuna controlada/ })
    .click();
  await expect(page.getByText('OC OC-100 · FAC-100 · 2.000')).toBeVisible();
  await expect(page.getByText('SN-VAC-001')).toBeVisible();

  await page.getByRole('button', { name: 'Ver historial' }).click();
  const history = page.getByRole('dialog', { name: 'SN-VAC-001' });
  await expect(history.getByText('Recepción de compra')).toBeVisible();
  await expect(history.getByText('Origen externo')).toBeVisible();
  await history.getByRole('button', { name: 'Cerrar historial' }).click();

  await page.getByRole('button', { name: 'Registrar entrada' }).click();
  const movement = page.getByRole('dialog', { name: 'Vacuna controlada' });
  await movement.getByLabel('Cantidad').fill('1');
  await movement.getByLabel('Razón').fill('Nueva recepción');
  await movement.getByLabel('Referencia o evidencia').fill('FAC-101');
  await movement.getByLabel('Lote').fill('LOT-NUEVO');
  await movement.getByLabel('Caducidad').fill('2027-08-31');
  await movement.getByLabel('Números de serie').fill('SN-VAC-002');
  await movement.getByRole('button', { name: 'Registrar movimiento' }).click();

  await expect(
    page.getByText('Movimiento registrado; trazabilidad y alertas actualizadas.'),
  ).toBeVisible();
  expect(writes).toEqual([
    expect.objectContaining({
      productId,
      locationId: location.id,
      type: 'ENTRY',
      quantity: '1',
      lotCode: 'LOT-NUEVO',
      expiresOn: '2027-08-31',
      serialNumbers: ['SN-VAC-002'],
    }),
  ]);
});
