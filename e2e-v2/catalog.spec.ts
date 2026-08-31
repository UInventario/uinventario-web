import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { expectAccessible, expectViewportFit } from './accessibility.helpers';

const branch = {
  id: 'branch-1',
  name: 'Centro',
  timezone: 'America/Mexico_City',
  active: true,
  warehouses: [{ id: 'warehouse-1', name: 'Principal', active: true, locations: [] }],
  cashRegisters: [{ id: 'register-1', name: 'Caja 1', code: 'CAJA-01' }],
};

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: 'product-1',
    name: 'Café molido',
    sku: 'CAFE-01',
    barcode: '7500000000001',
    withoutCode: false,
    stockBehavior: 'TRACKED',
    taxBehavior: 'STANDARD',
    baseUnit: 'UNIT',
    quantityPrecision: 0,
    quantityRounding: 'HALF_UP',
    minimumQuantity: '1',
    trackLots: false,
    trackSerials: false,
    category: { id: 'category-1', name: 'Bebidas' },
    brand: { id: 'brand-1', name: 'Marca Casa' },
    cost: '80.00',
    price: '119.90',
    active: true,
    version: 1,
    sellable: true,
    ...overrides,
  };
}

function session(permissions = ['PRODUCTS_VIEW', 'PRODUCTS_MANAGE']) {
  return {
    data: {
      user: {
        id: 'user-1',
        email: 'admin@example.com',
        roles: ['ADMIN'],
        permissions,
      },
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

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockBase(
  page: Page,
  handler: (route: Route, path: string) => Promise<boolean>,
  permissions?: string[],
): Promise<void> {
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    if (await handler(route, path)) return;
    if (path === '/auth/sessions/current') return json(route, session(permissions));
    if (path === '/organization/branches')
      return json(route, { data: [branch], meta: { apiVersion: '1' } });
    throw new Error(`Request no simulada: ${route.request().method()} ${path}`);
  });
}

test('keeps catalog read-only when product management permission is absent', async ({
  page,
}, testInfo) => {
  await mockBase(
    page,
    async (route, path) => {
      if (path === '/products/options') {
        await json(route, { data: { categories: [], brands: [] }, meta: { apiVersion: '1' } });
        return true;
      }
      if (path === '/products') {
        await json(route, {
          data: [product()],
          meta: {
            apiVersion: '1',
            pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
          },
        });
        return true;
      }
      return false;
    },
    ['INVENTORY_VIEW'],
  );

  await page.goto('./catalogo');
  await expect(page.getByText('Café molido', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nuevo producto' })).toHaveCount(0);
  await expect(page.getByLabel('Áreas del catálogo').getByText('Categorías y marcas')).toHaveCount(
    0,
  );
  await expect(page.getByRole('button', { name: 'Editar Café molido' })).toHaveCount(0);
  await expectViewportFit(page, 'Catálogo de solo lectura');
  await expectAccessible(page, 'Catálogo de solo lectura');
  if ((page.viewportSize()?.width ?? 0) <= 768) {
    await page.screenshot({
      path: testInfo.outputPath('uin-215-catalog-mobile.png'),
      fullPage: true,
    });
  }
});

test('filters, creates, edits and safely retires products', async ({ page }) => {
  let products = [product()];
  const writes: Array<{ method: string; body: Record<string, unknown> | null }> = [];
  let lastQuery = '';
  await mockBase(page, async (route, path) => {
    const method = route.request().method();
    if (path === '/products/options') {
      await json(route, {
        data: {
          categories: [{ id: 'category-1', name: 'Bebidas' }],
          brands: [{ id: 'brand-1', name: 'Marca Casa' }],
        },
        meta: { apiVersion: '1' },
      });
      return true;
    }
    if (path === '/products' && method === 'GET') {
      lastQuery = new URL(route.request().url()).search;
      const status = new URL(route.request().url()).searchParams.get('status');
      const data = status === 'ACTIVE' ? products.filter((item) => item.active) : products;
      await json(route, {
        data,
        meta: {
          apiVersion: '1',
          pagination: { page: 1, pageSize: 20, total: data.length, totalPages: 1 },
        },
      });
      return true;
    }
    if (path === '/products' && method === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      writes.push({ method: 'POST', body });
      products = [
        ...products,
        product({
          id: 'product-2',
          ...body,
          version: 1,
          active: true,
          category: null,
          brand: null,
        }),
      ];
      await json(route, { data: products.at(-1), meta: { apiVersion: '1' } }, 201);
      return true;
    }
    if (path === '/products/product-2' && method === 'PATCH') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      writes.push({ method: 'PATCH', body });
      products = products.map((item) =>
        item.id === 'product-2' ? { ...item, ...body, version: 2 } : item,
      );
      await json(route, { data: products[1], meta: { apiVersion: '1' } });
      return true;
    }
    if (path === '/products/product-2' && method === 'DELETE') {
      writes.push({ method: 'DELETE', body: null });
      products = products.filter((item) => item.id !== 'product-2');
      await json(route, { data: { outcome: 'DELETED', product: null }, meta: { apiVersion: '1' } });
      return true;
    }
    return false;
  });

  await page.goto('./catalogo');
  await expect(page.getByText('Café molido', { exact: true })).toBeVisible();
  await page.getByLabel('Buscar productos').fill('café');
  await page.getByLabel('Categoría').selectOption('category-1');
  await page.getByRole('button', { name: 'Aplicar' }).click();
  await expect(page).toHaveURL(/q=caf%C3%A9/);
  expect(lastQuery).toContain('categoryId=category-1');

  await page.getByRole('button', { name: 'Nuevo producto' }).click();
  await page.getByLabel('Nombre').fill('Té verde');
  await page.getByLabel('SKU').fill('te-01');
  await page.getByLabel('Costo').fill('20.00');
  await page.getByLabel('Precio').fill('35.00');
  await page.getByRole('button', { name: 'Guardar producto' }).click();
  await expect(page.getByText('Té verde', { exact: true })).toBeVisible();
  expect(writes[0].body).toMatchObject({
    name: 'Té verde',
    sku: 'TE-01',
    cost: '20.00',
    price: '35.00',
  });

  await page.getByRole('button', { name: 'Editar Té verde' }).click();
  await page.getByLabel('Nombre').fill('Té verde premium');
  await page.getByRole('button', { name: 'Guardar producto' }).click();
  expect(writes[1].body?.['version']).toBe(1);
  await page.getByRole('button', { name: 'Retirar Té verde premium' }).click();
  await page.getByLabel(/Escribe Té verde premium/).fill('Té verde premium');
  await page.getByRole('button', { name: 'Retirar', exact: true }).click();
  await expect(page.getByText('Té verde premium', { exact: true })).toHaveCount(0);
  expect(writes.at(-1)?.method).toBe('DELETE');
});

test('manages classifications and confirms an atomic product import', async ({ page }) => {
  const categories = [
    { id: 'category-1', name: 'Bebidas', active: true, productCount: 1 },
    { id: 'category-2', name: 'Despensa', active: true, productCount: 0 },
  ];
  let confirmationKey = '';
  let retirementReplacement = '';
  await mockBase(page, async (route, path) => {
    const method = route.request().method();
    if (path === '/products/options') {
      await json(route, { data: { categories, brands: [] }, meta: { apiVersion: '1' } });
      return true;
    }
    if (path === '/products' && method === 'GET') {
      await json(route, {
        data: [product()],
        meta: { apiVersion: '1', pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } },
      });
      return true;
    }
    if (path === '/catalog/categories' && method === 'GET') {
      await json(route, { data: categories, meta: { apiVersion: '1' } });
      return true;
    }
    if (path === '/catalog/brands' && method === 'GET') {
      await json(route, { data: [], meta: { apiVersion: '1' } });
      return true;
    }
    if (path === '/catalog/categories/category-1' && method === 'DELETE') {
      retirementReplacement =
        new URL(route.request().url()).searchParams.get('replacementId') ?? '';
      await json(route, {
        data: { classification: { ...categories[0], active: false }, reassignedProducts: 1 },
        meta: { apiVersion: '1' },
      });
      return true;
    }
    if (path === '/products/imports/preview') {
      await json(route, {
        data: {
          id: '11111111-1111-4111-8111-111111111111',
          status: 'PREVIEWED',
          sourceFilename: 'productos.csv',
          summary: { rows: 1, creates: 1, updates: 0, unchanged: 0, errors: 0 },
          canConfirm: true,
          rows: [
            {
              id: 'row-1',
              rowNumber: 2,
              action: 'CREATE',
              name: 'Chocolate',
              sku: 'CHOCO-01',
              barcode: null,
              cost: '10.00',
              price: '18.00',
              errors: [],
            },
          ],
        },
      });
      return true;
    }
    if (path.endsWith('/confirm')) {
      confirmationKey = route.request().headers()['idempotency-key'] ?? '';
      await json(route, {
        data: {
          id: '11111111-1111-4111-8111-111111111111',
          status: 'CONFIRMED',
          sourceFilename: 'productos.csv',
          summary: { rows: 1, creates: 1, updates: 0, unchanged: 0, errors: 0 },
          canConfirm: false,
          rows: [],
        },
      });
      return true;
    }
    return false;
  });

  await page.goto('./catalogo');
  await page.getByRole('button', { name: 'Categorías y marcas' }).click();
  await page.getByRole('button', { name: 'Retirar Bebidas' }).click();
  await page.getByLabel(/Reasignar 1 producto/).selectOption('category-2');
  await page.getByRole('button', { name: 'Retirar', exact: true }).click();
  expect(retirementReplacement).toBe('category-2');

  await page.getByLabel('Áreas del catálogo').getByRole('button', { name: 'Importar' }).click();
  await page.getByLabel('Archivo CSV o Excel').setInputFiles({
    name: 'productos.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('name,sku,cost,price\nChocolate,CHOCO-01,10,18'),
  });
  await page.getByRole('button', { name: 'Generar vista previa' }).click();
  await expect(page.getByText('Chocolate')).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar lote completo' }).click();
  expect(confirmationKey).toMatch(/^web-v2-product-import:[\w-]{36}$/);
});
