import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

const branch = { id: 'branch-1', name: 'Centro', timezone: 'America/Mexico_City' };
const pagination = (url: URL) => ({
  page: Number(url.searchParams.get('page') || 1),
  pageSize: 25,
  total: 30,
  totalPages: 2,
});

async function json(route: Route, body: unknown): Promise<void> {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockReports(page: Page): Promise<void> {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');
    if (path === '/auth/sessions/current') {
      return json(route, {
        data: {
          user: {
            id: 'user-1',
            email: 'admin@example.com',
            roles: ['ADMIN'],
            permissions: [
              'SALES_MANAGE',
              'SALES_RETURN',
              'INVENTORY_VIEW',
              'INVENTORY_VALUATION_MANAGE',
            ],
          },
          tenant: { id: 'tenant-1', name: 'Tienda Central' },
          context: {
            branch: { id: branch.id, name: branch.name },
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
      return json(route, {
        data: [
          {
            ...branch,
            active: true,
            warehouses: [{ id: 'warehouse-1', name: 'Principal', active: true, locations: [] }],
            cashRegisters: [{ id: 'register-1', name: 'Caja 1', code: 'CAJA-1' }],
          },
        ],
        meta: { apiVersion: '1' },
      });
    }
    if (path === '/pos/reports/sales-cash') {
      return json(route, {
        data: {
          scope: [branch],
          options: {
            branches: [branch],
            registers: [{ id: 'register-1', name: 'Caja 1', code: 'CAJA-1', branch_id: branch.id }],
            users: [{ id: 'user-1', email: 'admin@example.com' }],
          },
          summary: {
            sales: { total: 1, completed: 1, voided: 0, net: '119.90', voidedAmount: '0.00' },
            payments: [{ method: 'CASH', status: 'COMPLETED', count: 1, amount: '119.90' }],
            cash: {
              shifts: 1,
              open: 0,
              closed: 1,
              expected: '1119.90',
              counted: '1119.90',
              difference: '0.00',
            },
            reconciliation: { salesNet: '119.90', paymentsApplied: '119.90', matches: true },
          },
          sales: [
            {
              id: 'sale-1',
              receiptNumber: 'V-000119',
              status: 'COMPLETED',
              branch: { id: branch.id, name: branch.name },
              cashRegister: { id: 'register-1', name: 'Caja 1', code: 'CAJA-1' },
              user: { id: 'user-1', email: 'admin@example.com' },
              currency: 'MXN',
              total: '119.90',
              payments: [
                {
                  method: 'CASH',
                  status: 'COMPLETED',
                  amount: '119.90',
                  change: '0.10',
                  reference: null,
                },
              ],
              createdAt: '2026-08-30T18:00:00.000Z',
              voidedAt: null,
            },
          ],
          shifts: [
            {
              id: 'shift-1',
              status: 'CLOSED',
              branch: { id: branch.id, name: branch.name },
              cashRegister: { id: 'register-1', name: 'Caja 1', code: 'CAJA-1' },
              openedByEmail: 'admin@example.com',
              currency: 'MXN',
              opening: '1000.00',
              expected: '1119.90',
              counted: '1119.90',
              difference: '0.00',
              openedAt: '2026-08-30T16:00:00.000Z',
              closedAt: '2026-08-30T20:00:00.000Z',
            },
          ],
          total: 30,
        },
        meta: { apiVersion: '1', pagination: pagination(url), periodTimezone: 'BRANCH_LOCAL' },
      });
    }
    if (path === '/pos/reports/profitability') {
      return json(route, {
        data: {
          scope: [branch],
          formulas: { margin: 'netRevenue - netCost' },
          currencies: [
            {
              currency: 'MXN',
              sales: 1,
              returns: 0,
              cancellations: 0,
              grossRevenue: '119.90',
              discounts: '0.00',
              salesTotal: '119.90',
              returnTotal: '0.00',
              netTotal: '119.90',
              netRevenue: '119.90',
              taxes: '0.00',
              historicalCost: '60.00',
              returnedCost: '0.00',
              netCost: '60.00',
              margin: '59.90',
              marginRate: 0.4996,
              paymentObligations: '119.90',
              creditSales: '0.00',
              refundsSettled: '0.00',
              voidedAmount: '0.00',
              salesMatchPayments: true,
            },
          ],
          products: [
            {
              product: { id: 'product-1', name: 'Café de especialidad', sku: 'CAF-119' },
              currency: 'MXN',
              soldQuantity: '1.000',
              returnedQuantity: '0.000',
              grossRevenue: '119.90',
              discounts: '0.00',
              netRevenue: '119.90',
              taxes: '0.00',
              netCost: '60.00',
              margin: '59.90',
            },
          ],
          activities: [
            {
              id: 'activity-1',
              type: 'SALE',
              saleId: 'sale-1',
              receiptNumber: 'V-000119',
              branchName: branch.name,
              cashRegisterName: 'Caja 1',
              currency: 'MXN',
              netRevenue: '119.90',
              taxes: '0.00',
              historicalCost: '60.00',
              marginImpact: '59.90',
              paymentOrSettlement: '119.90',
              reconciles: true,
              occurredAt: '2026-08-30T18:00:00.000Z',
            },
          ],
          total: 30,
        },
        meta: { apiVersion: '1', pagination: pagination(url), periodTimezone: 'BRANCH_LOCAL' },
      });
    }
    if (path === '/inventory/reports/activity') {
      return json(route, {
        data: {
          period: { dateFrom: null, dateTo: null, timezone: 'BRANCH_LOCAL' },
          scope: {
            branches: [branch],
            warehouses: [{ id: 'warehouse-1', name: 'Principal', branch }],
          },
          filters: { categories: [{ id: 'category-1', name: 'Bebidas' }] },
          definitions: { rotation: 'netSoldQuantity / averageQuantity' },
          items: [
            {
              product: {
                id: 'product-1',
                name: 'Café de especialidad',
                sku: 'CAF-119',
                category: { id: 'category-1', name: 'Bebidas' },
              },
              openingQuantity: '20.000',
              closingQuantity: '19.000',
              averageQuantity: '19.500',
              netSoldQuantity: '1.000',
              lossQuantity: '0.000',
              activityQuantity: '1.000',
              rotation: 0.0513,
              status: 'ACTIVE',
              lastMovementAt: '2026-08-30T18:00:00.000Z',
            },
          ],
          total: 30,
        },
        meta: { apiVersion: '1', pagination: pagination(url), periodTimezone: 'BRANCH_LOCAL' },
      });
    }
    if (path === '/inventory/reports/activity/product-1/movements') {
      return json(route, {
        data: [
          {
            id: 'movement-1',
            type: 'SALE',
            quantityChange: '-1.000',
            resultingQuantity: '19.000',
            reason: 'Venta V-000119',
            reference: 'V-000119',
            occurredAt: '2026-08-30T18:00:00.000Z',
            branchName: branch.name,
            warehouseName: 'Principal',
            locationName: 'Piso de venta',
          },
        ],
        meta: { apiVersion: '1', pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 } },
      });
    }
    if (path === '/pos/reports/sales/sale-1') {
      return json(route, {
        data: {
          id: 'sale-1',
          receiptNumber: 'V-000119',
          status: 'COMPLETED',
          context: {
            branch: { id: branch.id, name: branch.name },
            warehouse: { id: 'warehouse-1', name: 'Principal' },
            cashRegister: { id: 'register-1', name: 'Caja 1', code: 'CAJA-1' },
          },
          user: { id: 'user-1', email: 'admin@example.com' },
          customer: null,
          currency: 'MXN',
          lines: [
            {
              id: 'line-1',
              product: { id: 'product-1', name: 'Café de especialidad', sku: 'CAF-119' },
              quantity: '1.000',
              unitPrice: '119.90',
              subtotal: '119.90',
              tax: '0.00',
              total: '119.90',
            },
          ],
          totals: {
            gross: '119.90',
            discount: '0.00',
            subtotal: '119.90',
            tax: '0.00',
            total: '119.90',
            grossProfit: '59.90',
          },
          payments: [
            {
              id: 'payment-1',
              method: 'CASH',
              status: 'COMPLETED',
              amountReceived: '120.00',
              amountApplied: '119.90',
              change: '0.10',
              reference: null,
              provider: 'INTERNAL',
              authorizationCode: null,
            },
          ],
          movements: [
            {
              id: 'movement-1',
              type: 'SALE',
              product: { id: 'product-1', name: 'Café de especialidad', sku: 'CAF-119' },
              location: { id: 'location-1', name: 'Piso de venta', code: 'PISO' },
              quantityChange: '-1.000',
              resultingQuantity: '19.000',
              reference: 'V-000119',
              createdAt: '2026-08-30T18:00:00.000Z',
            },
          ],
          createdAt: '2026-08-30T18:00:00.000Z',
          void: null,
        },
        meta: { apiVersion: '1' },
      });
    }
    if (path === '/pos/reports/sales/sale-1/returns') {
      return json(route, {
        data: [
          {
            id: 'return-1',
            reason: 'Producto dañado',
            settlementStatus: 'SETTLED',
            refundableAmount: '20.00',
            totals: { subtotal: '20.00', tax: '0.00', total: '20.00' },
            returnedBy: { id: 'user-1', email: 'admin@example.com' },
            createdAt: '2026-08-30T19:00:00.000Z',
            lines: [],
          },
        ],
        meta: { apiVersion: '1' },
      });
    }
    await route.abort('failed');
  });
}

test.beforeEach(async ({ page }) => mockReports(page));

test('filters, paginates and opens complete sale traceability', async ({ page }) => {
  await page.goto('./reportes/ventas');
  await expect(page.getByRole('heading', { name: 'Historial de ventas' })).toBeVisible();
  await page.getByLabel('Desde').fill('2026-08-01');
  await page.getByLabel('Estado', { exact: true }).selectOption('COMPLETED');
  await page.getByRole('button', { name: 'Aplicar' }).click();
  await expect(page).toHaveURL(/dateFrom=2026-08-01/);
  await expect(page).toHaveURL(/status=COMPLETED/);
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page).toHaveURL(/page=2/);
  await page.getByRole('button', { name: 'V-000119' }).click();
  const dialog = page.getByRole('dialog', { name: 'V-000119' });
  await expect(dialog.getByText('Café de especialidad').first()).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Pagos' })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Movimientos de inventario' })).toBeVisible();
  await expect(dialog.getByText('Producto dañado')).toBeVisible();
});

test('keeps each operational report separate and exports or drills down', async ({ page }) => {
  await page.goto('./reportes/caja');
  await expect(page.getByRole('heading', { name: 'Reporte de caja' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Centro · Caja 1' })).toBeVisible();
  const reportTabs = page.getByRole('navigation', { name: 'Tipos de reporte' });
  await reportTabs.getByRole('link', { name: 'Márgenes' }).click();
  await expect(page.getByRole('heading', { name: 'Márgenes' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar página' }).click();
  expect((await download).suggestedFilename()).toBe('reporte-margenes.csv');
  await reportTabs.getByRole('link', { name: 'Inventario' }).click();
  await page.getByRole('button', { name: 'Café de especialidad' }).click();
  const dialog = page.getByRole('dialog', { name: 'Café de especialidad' });
  await expect(dialog.getByText('Venta V-000119')).toBeVisible();
  await dialog.getByRole('button', { name: 'Cerrar movimientos' }).click();
  await reportTabs.getByRole('link', { name: 'Actividad' }).click();
  await expect(page.getByRole('heading', { name: 'Actividad comercial' })).toBeVisible();
  await expect(page.getByText('Conciliado')).toBeVisible();
});
