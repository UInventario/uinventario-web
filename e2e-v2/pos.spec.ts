import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

const product = (overrides: Record<string, unknown> = {}) => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Café molido',
  sku: 'CAF-001',
  barcode: '750100000001',
  withoutCode: false,
  stockBehavior: 'TRACKED',
  taxBehavior: 'STANDARD',
  baseUnit: 'KILOGRAM',
  quantityPrecision: 3,
  quantityRounding: 'HALF_UP',
  minimumQuantity: '0.250',
  trackLots: false,
  trackSerials: false,
  price: '120.00',
  active: true,
  sellable: true,
  ...overrides,
});

const service = product({
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Instalación básica',
  sku: 'AUTO-00042',
  barcode: null,
  withoutCode: true,
  stockBehavior: 'UNTRACKED',
  baseUnit: 'UNIT',
  quantityPrecision: 0,
  minimumQuantity: '1.000',
  price: '350.00',
});

const branch = {
  id: 'branch-1',
  name: 'Centro',
  timezone: 'America/Mexico_City',
  active: true,
  warehouses: [{ id: 'warehouse-1', name: 'Principal', active: true, locations: [] }],
  cashRegisters: [
    { id: 'register-1', name: 'Caja 1', code: 'CAJA-01' },
    { id: 'register-2', name: 'Caja 2', code: 'CAJA-02' },
  ],
};

function session(registerId: string, permissions: string[]) {
  const register = branch.cashRegisters.find(({ id }) => id === registerId)!;
  return {
    data: {
      user: { id: 'user-1', email: 'cashier@example.com', roles: ['CASHIER'], permissions },
      tenant: { id: 'tenant-1', name: 'Tienda Central' },
      context: {
        branch: { id: branch.id, name: branch.name },
        warehouse: { id: 'warehouse-1', name: 'Principal' },
        cashRegister: register,
      },
      nextStep: 'APPLICATION',
    },
    meta: { apiVersion: '1', sessionExpiresAt: new Date(Date.now() + 3_600_000).toISOString() },
  };
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

function quoteFor(lines: Array<Record<string, unknown>>) {
  const quoted = lines.map((line) => {
    const source = line['productId'] === service.id ? service : product();
    const quantity = String(line['quantity']);
    const price = String(line['manualUnitPrice'] ?? source.price);
    const total = (Number(quantity) * Number(price)).toFixed(2);
    return {
      product: source,
      quantity,
      note: line['note'] ?? null,
      availableQuantity: source.stockBehavior === 'UNTRACKED' ? '0.000' : '20.000',
      unitPrice: price,
      priceSource: line['manualUnitPrice'] ? 'MANUAL' : 'BASE',
      priceOverrideReason: line['priceOverrideReason'] ?? null,
      priceList: null,
      grossTotal: total,
      subtotal: total,
      tax: '0.00',
      total,
    };
  });
  const total = quoted.reduce((sum, line) => sum + Number(line.total), 0).toFixed(2);
  return {
    data: {
      context: {
        branch: { id: branch.id, name: branch.name },
        warehouse: { id: 'warehouse-1', name: 'Principal' },
        cashRegister: branch.cashRegisters[0],
      },
      currency: 'MXN',
      taxRate: '0.0000',
      lines: quoted,
      totals: {
        gross: total,
        lineDiscount: '0.00',
        promotionDiscount: '0.00',
        saleDiscount: '0.00',
        discount: '0.00',
        subtotal: total,
        tax: '0.00',
        total,
      },
    },
    meta: { apiVersion: '1', recalculatedAt: '2026-08-30T17:00:00.000Z' },
  };
}

interface MockOptions {
  permissions?: string[];
  register?: { current: string };
  quoteWrites?: Array<Array<Record<string, unknown>>>;
}

async function mockPos(page: Page, options: MockOptions = {}): Promise<void> {
  const permissions = options.permissions ?? ['SALES_MANAGE', 'SALES_PRICE_OVERRIDE'];
  const register = options.register ?? { current: 'register-1' };
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');
    if (path === '/auth/sessions/current') {
      await json(route, session(register.current, permissions));
      return;
    }
    if (path === '/organization/branches') {
      await json(route, { data: [branch], meta: { apiVersion: '1' } });
      return;
    }
    if (path === '/pos/register-shifts/current') {
      await json(route, {
        data: {
          id: 'shift-1',
          status: 'OPEN',
          branch: { id: branch.id, name: branch.name },
          cashRegister: branch.cashRegisters.find(({ id }) => id === register.current),
          openedBy: { id: 'user-1', email: 'cashier@example.com' },
          openingAmount: '1000.00',
          currency: 'MXN',
          openedAt: '2026-08-30T15:00:00.000Z',
        },
        meta: { apiVersion: '1' },
      });
      return;
    }
    if (path === '/products' && route.request().method() === 'GET') {
      const query = url.searchParams.get('q')?.toLocaleLowerCase() ?? '';
      if (query === 'slow') await new Promise((resolve) => setTimeout(resolve, 450));
      const values = [product(), service].filter(
        (item) =>
          !query ||
          item.name.toLocaleLowerCase().includes(query) ||
          item.sku.toLocaleLowerCase().includes(query),
      );
      await json(route, {
        data: values,
        meta: {
          apiVersion: '1',
          pagination: { page: 1, pageSize: 24, total: values.length, totalPages: 1 },
        },
      });
      return;
    }
    if (path === '/products/resolve-code') {
      const code = url.searchParams.get('code');
      if (code === product().barcode || code === product().sku) {
        await json(route, { data: product(), meta: { apiVersion: '1' } });
      } else {
        await json(route, { code: 'PRODUCT_CODE_NOT_FOUND', message: 'Not found' }, 404);
      }
      return;
    }
    if (path === '/pos/cart/quote' && route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as { lines: Array<Record<string, unknown>> };
      options.quoteWrites?.push(body.lines);
      await json(route, quoteFor(body.lines));
      return;
    }
    throw new Error(`Request no simulada: ${route.request().method()} ${path}`);
  });
}

test('supports touch, reader keyboard and non-blocking search while quoting the cart', async ({
  page,
}) => {
  const writes: Array<Array<Record<string, unknown>>> = [];
  await mockPos(page, { quoteWrites: writes });
  await page.goto('./ventas/pos');

  await expect(page.getByRole('region', { name: 'Venta rápida' })).toBeVisible();
  await page.getByRole('button', { name: 'Agregar Instalación básica' }).click();
  await expect(page.getByText('Instalación básica', { exact: true }).last()).toBeVisible();

  const search = page.getByLabel('Buscar o escanear producto');
  await search.fill('750100000001');
  await search.press('Enter');
  await expect(page.getByText('Café molido', { exact: true }).last()).toBeVisible();
  await expect(page.locator('.totals .total').getByText('$380.00')).toBeVisible();

  await search.fill('slow');
  await page.getByRole('button', { name: 'Sumar cantidad de Café molido' }).click();
  await expect(page.getByText('0.500', { exact: true })).toBeVisible();
  await expect(page.locator('.totals .total').getByText('$410.00')).toBeVisible();
  expect(writes.at(-1)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ productId: product().id, quantity: '0.500' }),
    ]),
  );
});

test('applies fractional quantities and price overrides only with permission', async ({ page }) => {
  const writes: Array<Array<Record<string, unknown>>> = [];
  await mockPos(page, { quoteWrites: writes });
  await page.goto('./ventas/pos');
  await page.getByRole('button', { name: 'Agregar Café molido' }).click();
  await page.getByRole('button', { name: 'Editar Café molido' }).click();

  const dialog = page.getByRole('dialog', { name: 'Café molido' });
  await dialog.getByLabel('Cantidad').fill('0.750');
  await dialog.getByLabel('Precio manual').fill('100');
  await dialog.getByLabel('Motivo del override').fill('Precio autorizado por gerencia');
  await dialog.getByRole('button', { name: 'Aplicar cambios' }).click();

  await expect(page.getByText('0.750', { exact: true })).toBeVisible();
  await expect(page.getByText('Override')).toBeVisible();
  await expect
    .poll(() => writes.at(-1)?.[0])
    .toMatchObject({
      quantity: '0.750',
      manualUnitPrice: '100',
      priceOverrideReason: 'Precio autorizado por gerencia',
    });
});

test('removes persisted overrides when the cashier lacks override permission', async ({ page }) => {
  const writes: Array<Array<Record<string, unknown>>> = [];
  await page.addInitScript(
    (line) => {
      localStorage.setItem(
        'uinventario:v2:pos-cart:tenant-1:user-1:branch-1:warehouse-1:register-1',
        JSON.stringify([line]),
      );
    },
    {
      product: product(),
      quantity: '0.500',
      manualUnitPrice: '60.00',
      priceOverrideReason: 'Persistido anteriormente',
    },
  );
  await mockPos(page, { permissions: ['SALES_MANAGE'], quoteWrites: writes });
  await page.goto('./ventas/pos');

  await expect(page.getByText('Café molido', { exact: true }).last()).toBeVisible();
  await page.getByRole('button', { name: 'Editar Café molido' }).click();
  await expect(page.getByLabel('Precio manual')).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect.poll(() => writes.at(-1)?.[0]).not.toHaveProperty('manualUnitPrice');
});

test('restores carts only inside the original operational context', async ({ page }) => {
  const register = { current: 'register-1' };
  await mockPos(page, { register });
  await page.goto('./ventas/pos');
  await page.getByRole('button', { name: 'Agregar Café molido' }).click();
  await expect(page.getByText('Café molido', { exact: true }).last()).toBeVisible();

  register.current = 'register-2';
  await page.reload();
  await expect(page.getByText('La venta está vacía')).toBeVisible();

  register.current = 'register-1';
  await page.reload();
  await expect(page.getByText('Café molido', { exact: true }).last()).toBeVisible();
});

test('adds the detected camera code without replacing the existing cart', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: async () => new MediaStream() },
    });
    Object.defineProperty(globalThis, 'BarcodeDetector', {
      configurable: true,
      value: class {
        async detect() {
          return [{ rawValue: '750100000001' }];
        }
      },
    });
    HTMLMediaElement.prototype.play = async () => undefined;
  });
  await mockPos(page);
  await page.goto('./ventas/pos');
  await page.getByRole('button', { name: 'Agregar Instalación básica' }).click();
  await page.getByRole('button', { name: 'Escanear con cámara' }).click();

  await expect(page.getByText('Café molido', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('Instalación básica', { exact: true }).last()).toBeVisible();
});
