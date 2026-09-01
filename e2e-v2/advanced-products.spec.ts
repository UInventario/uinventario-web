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

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Playera básica',
    sku: 'PLAYERA',
    barcode: 'PLAYERA-BASE',
    withoutCode: false,
    stockBehavior: 'TRACKED',
    taxBehavior: 'STANDARD',
    baseUnit: 'UNIT',
    quantityPrecision: 0,
    quantityRounding: 'HALF_UP',
    minimumQuantity: '1',
    trackLots: false,
    trackSerials: false,
    category: { id: 'category-1', name: 'Ropa' },
    brand: null,
    cost: '100.00',
    price: '180.00',
    active: true,
    version: 1,
    sellable: true,
    parentProductId: null,
    variantAttributes: [],
    variantValues: [],
    variants: [],
    kit: null,
    ...overrides,
  };
}

function session() {
  return {
    data: {
      user: {
        id: 'user-1',
        email: 'admin@example.com',
        roles: ['ADMIN'],
        permissions: ['PRODUCTS_VIEW', 'PRODUCTS_MANAGE'],
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

async function mockApi(
  page: Page,
  handler: (route: Route, path: string, method: string) => Promise<boolean>,
): Promise<void> {
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    const method = route.request().method();
    if (await handler(route, path, method)) return;
    if (path === '/auth/sessions/current') return json(route, session());
    if (path === '/organization/branches') {
      return json(route, { data: [branch], meta: { apiVersion: '1' } });
    }
    throw new Error(`Request no simulada: ${method} ${path}`);
  });
}

function list(products: readonly unknown[], pageSize = 100) {
  return {
    data: products,
    meta: {
      apiVersion: '1',
      pagination: { page: 1, pageSize, total: products.length, totalPages: 1 },
    },
  };
}

async function expectNoHorizontalPageOverflow(page: Page): Promise<void> {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

test('opens a secondary workspace and saves the exact variant matrix', async ({ page }) => {
  let current = product();
  let variantsWrite: Record<string, unknown> | null = null;
  await mockApi(page, async (route, path, method) => {
    if (path === '/products/options') {
      await json(route, { data: { categories: [], brands: [] }, meta: { apiVersion: '1' } });
      return true;
    }
    if (path === '/products' && method === 'GET') {
      const pageSize = Number(new URL(route.request().url()).searchParams.get('pageSize'));
      await json(route, list([current], pageSize));
      return true;
    }
    if (path === `/products/${current.id}` && method === 'GET') {
      await json(route, { data: current, meta: { apiVersion: '1' } });
      return true;
    }
    if (path === `/products/${current.id}/variants` && method === 'PUT') {
      variantsWrite = route.request().postDataJSON() as Record<string, unknown>;
      const input = variantsWrite as {
        attributes: unknown[];
        variants: Array<Record<string, unknown>>;
      };
      current = product({
        version: 2,
        sellable: false,
        variantAttributes: input.attributes,
        variants: input.variants.map((variant, index) =>
          product({
            ...variant,
            id: `22222222-2222-4222-8222-22222222222${index}`,
            version: 1,
            parentProductId: current.id,
            variantValues: (variant['values'] as string[]).map((value, valueIndex) => ({
              attribute: (input.attributes[valueIndex] as { name: string }).name,
              value,
            })),
          }),
        ),
      });
      await json(route, { data: current, meta: { apiVersion: '1' } });
      return true;
    }
    return false;
  });

  await page.goto('./catalogo');
  await page.getByRole('button', { name: 'Configuración avanzada de Playera básica' }).click();
  await expect(page).toHaveURL(/catalogo\/productos\/.+\/avanzado/);
  await expect(page.getByRole('heading', { name: 'Playera básica' })).toBeVisible();
  await expectNoHorizontalPageOverflow(page);
  await page.getByLabel('Nombre del atributo 1').fill('Color');
  await page.getByLabel('Valores del atributo 1').fill('Negro, Blanco');
  await page.getByRole('button', { name: 'Agregar atributo' }).click();
  await page.getByLabel('Nombre del atributo 2').fill('Talla');
  await page.getByLabel('Valores del atributo 2').fill('S, M');
  await page.getByRole('button', { name: 'Generar o actualizar combinaciones' }).click();
  await expect(page.getByText('4 combinación(es) listas para revisar.')).toBeVisible();
  await page.getByLabel('Código de Negro S').fill('PLAYERA-NEGRO-S-QR');
  await page.getByLabel('Costo de Negro S').fill('105.50');
  await page.getByLabel('Precio de Negro S').fill('199.90');
  await page.getByRole('button', { name: 'Guardar variantes' }).click();

  await expect(page.getByText('Variantes guardadas. Ya están disponibles')).toBeVisible();
  expect(variantsWrite).toMatchObject({
    version: 1,
    attributes: [
      { name: 'Color', values: ['Negro', 'Blanco'] },
      { name: 'Talla', values: ['S', 'M'] },
    ],
  });
  expect((variantsWrite?.['variants'] as unknown[]).length).toBe(4);
  expect((variantsWrite?.['variants'] as Array<Record<string, unknown>>)[0]).toMatchObject({
    values: ['Negro', 'S'],
    sku: 'PLAYERA-NEGRO-S',
    barcode: 'PLAYERA-NEGRO-S-QR',
    cost: '105.50',
    price: '199.90',
  });
});

test('validates fractional component quantities and can enable or remove a kit', async ({
  page,
}) => {
  const kitId = '33333333-3333-4333-8333-333333333333';
  const component = product({
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Café a granel',
    sku: 'CAFE-GRANEL',
    baseUnit: 'KILOGRAM',
    quantityPrecision: 2,
    minimumQuantity: '0.25',
    cost: '120.00',
    price: '190.00',
  });
  let current = product({ id: kitId, name: 'Kit degustación', sku: 'KIT-DEGUSTA' });
  const writes: Array<Record<string, unknown>> = [];
  await mockApi(page, async (route, path, method) => {
    if (path === '/products' && method === 'GET') {
      await json(route, list([current, component]));
      return true;
    }
    if (path === `/products/${kitId}` && method === 'GET') {
      await json(route, { data: current, meta: { apiVersion: '1' } });
      return true;
    }
    if (path === `/products/${kitId}/kit` && method === 'PUT') {
      const input = route.request().postDataJSON() as Record<string, unknown>;
      writes.push(input);
      current = product({
        ...current,
        version: Number(current.version) + 1,
        kit: input['enabled']
          ? {
              stockMode: input['stockMode'],
              priceRule: input['priceRule'],
              effectiveFrom: input['effectiveFrom'] ?? null,
              effectiveTo: input['effectiveTo'] ?? null,
              components: [
                {
                  product: { id: component.id, name: component.name, sku: component.sku },
                  quantity: '0.500',
                },
              ],
            }
          : null,
      });
      await json(route, { data: current, meta: { apiVersion: '1' } });
      return true;
    }
    return false;
  });

  await page.goto(`./catalogo/productos/${kitId}/avanzado`);
  await page.getByRole('button', { name: /Kits/ }).click();
  await page.getByLabel('Habilitar kit').check();
  await page.getByLabel('Cantidad del componente 1').fill('0.10');
  await expect(page.getByText('La cantidad mínima es 0.25.')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar kit' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'cantidad mínima' })).toBeVisible();
  await page.getByLabel('Cantidad del componente 1').fill('0.50');
  await page.getByLabel('Vigente desde').fill('2026-09-01');
  await page.getByLabel('Vigente hasta').fill('2026-12-31');
  await expectNoHorizontalPageOverflow(page);
  await page.getByRole('button', { name: 'Guardar kit' }).click();
  await expect(page.getByText('Kit guardado y listo para operar.')).toBeVisible();
  expect(writes[0]).toMatchObject({
    version: 1,
    enabled: true,
    stockMode: 'DERIVED',
    priceRule: 'FIXED',
    effectiveFrom: '2026-09-01T00:00:00.000Z',
    effectiveTo: '2026-12-31T00:00:00.000Z',
    components: [{ productId: component.id, quantity: '0.50' }],
  });

  await page.getByLabel('Habilitar kit').uncheck();
  await page.getByRole('button', { name: 'Guardar deshabilitado' }).click();
  await expect(page.getByText('Configuración de kit eliminada.')).toBeVisible();
  expect(writes[1]).toEqual({ version: 2, enabled: false });
});

test('keeps basic editing independent while enforcing its quantity policy', async ({ page }) => {
  let current = product();
  let updates = 0;
  await mockApi(page, async (route, path, method) => {
    if (path === '/products/options') {
      await json(route, { data: { categories: [], brands: [] }, meta: { apiVersion: '1' } });
      return true;
    }
    if (path === '/products' && method === 'GET') {
      await json(route, list([current], 20));
      return true;
    }
    if (path === `/products/${current.id}` && method === 'PATCH') {
      updates += 1;
      current = product({ ...current, ...route.request().postDataJSON(), version: 2 });
      await json(route, { data: current, meta: { apiVersion: '1' } });
      return true;
    }
    return false;
  });

  await page.goto('./catalogo');
  await page.getByRole('button', { name: 'Editar Playera básica' }).click();
  await page.getByLabel('Unidad base').selectOption('KILOGRAM');
  await page.getByLabel('Decimales').fill('1');
  await page.getByLabel('Cantidad mínima').fill('0.25');
  await page.getByRole('button', { name: 'Guardar producto' }).click();
  await expect(page.getByText(/cantidad mínima debe respetar la precisión/)).toBeVisible();
  expect(updates).toBe(0);
  await page.getByLabel('Cantidad mínima').fill('0.2');
  await page.getByRole('button', { name: 'Guardar producto' }).click();
  await expect(page.getByText('Producto actualizado.')).toBeVisible();
  expect(updates).toBe(1);
});
