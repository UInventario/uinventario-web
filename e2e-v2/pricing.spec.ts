import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

const branch = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Centro',
  timezone: 'America/Mexico_City',
  active: true,
  warehouses: [{ id: 'warehouse-1', name: 'Principal', active: true, locations: [] }],
  cashRegisters: [{ id: 'register-1', name: 'Caja 1', code: 'CAJA-01' }],
};
const product = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Café molido',
  sku: 'CAFE-01',
  price: '120.00',
};

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockPricing(
  page: Page,
  writes: Array<{ path: string; body: Record<string, unknown> }>,
  permissions = ['PRODUCTS_MANAGE', 'SALES_MANAGE'],
) {
  const lists: Record<string, unknown>[] = [];
  const promotions: Record<string, unknown>[] = [];
  let loyalty: Record<string, unknown> | null = null;
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
      });
      return;
    }
    if (path === '/organization/branches') {
      await json(route, { data: [branch], meta: { apiVersion: '1' } });
      return;
    }
    if (path === '/products' && method === 'GET') {
      await json(route, {
        data: [product],
        meta: { apiVersion: '1', pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 } },
      });
      return;
    }
    if (path === '/price-lists' && method === 'GET') {
      await json(route, { data: lists, meta: { apiVersion: '1' } });
      return;
    }
    if (path === '/price-lists' && method === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      writes.push({ path, body });
      const saved = {
        id: 'list-1',
        ...body,
        scope: {
          branch: body['branchId'] ? { id: branch.id, name: branch.name } : null,
          customer: null,
          channel: body['channel'] ?? null,
        },
        version: 1,
        items: (body['items'] as Array<Record<string, unknown>>).map((item, index) => ({
          id: `item-${index}`,
          product,
          price: item['price'],
        })),
        createdAt: '2026-08-31T00:00:00.000Z',
        updatedAt: '2026-08-31T00:00:00.000Z',
      };
      lists.push(saved);
      await json(route, { data: saved, meta: { apiVersion: '1' } }, 201);
      return;
    }
    if (path === '/promotions' && method === 'GET') {
      await json(route, { data: promotions, meta: { apiVersion: '1' } });
      return;
    }
    if (path === '/promotions' && method === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      writes.push({ path, body });
      const saved = {
        id: 'promotion-1',
        ...body,
        scope: { branch: null, customer: null, channel: body['channel'] ?? null },
        version: 1,
        products: (body['products'] as Array<Record<string, unknown>>).map((item) => ({
          product,
          quantity: item['quantity'],
        })),
        tiers: body['tiers'],
        discountPercent: body['discountPercent'] ?? null,
        fixedPrice: null,
        buyQuantity: null,
        rewardQuantity: null,
        createdAt: '2026-08-31T00:00:00.000Z',
        updatedAt: '2026-08-31T00:00:00.000Z',
      };
      promotions.push(saved);
      await json(route, { data: saved, meta: { apiVersion: '1' } }, 201);
      return;
    }
    if (path === '/loyalty/rules/current' && method === 'GET') {
      await json(route, { data: loyalty, meta: { apiVersion: '1' } });
      return;
    }
    if (path === '/loyalty/rules/current' && method === 'PUT') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      writes.push({ path, body });
      loyalty = {
        id: 'rule-1',
        version: 1,
        ...body,
        expirationDays: body['expirationDays'] ?? null,
        createdAt: '2026-08-31T00:00:00.000Z',
      };
      await json(route, { data: loyalty, meta: { apiVersion: '1' } });
      return;
    }
    throw new Error(`Request no simulada: ${method} ${path}`);
  });
}

test('creates contextual price lists, promotions and a versioned loyalty rule', async ({
  page,
}) => {
  const writes: Array<{ path: string; body: Record<string, unknown> }> = [];
  await mockPricing(page, writes);
  await page.goto('./catalogo/precios');
  await expect(page.getByRole('heading', { name: 'Precios y promociones' })).toBeVisible();
  await expect(page.getByText('Centro', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Nueva lista' }).click();
  const list = page.getByRole('dialog', { name: 'Nueva lista' });
  await list.getByLabel('Nombre').fill('Precio POS Centro');
  await list.getByLabel('Alcance').selectOption('BRANCH');
  await list.getByLabel('Canal').selectOption('POS');
  await list.locator('select[formcontrolname="productId"]').selectOption(product.id);
  await list.getByRole('button', { name: 'Agregar', exact: true }).click();
  await list.getByRole('button', { name: 'Guardar lista' }).click();
  await expect(page.getByText('Precio POS Centro')).toBeVisible();
  expect(writes[0]).toMatchObject({
    path: '/price-lists',
    body: {
      branchId: branch.id,
      channel: 'POS',
      items: [{ productId: product.id, price: '120.00' }],
    },
  });

  await page.getByRole('button', { name: 'Promociones', exact: true }).click();
  await page.getByRole('button', { name: 'Nueva promoción' }).click();
  const promotion = page.getByRole('dialog', { name: 'Nueva promoción' });
  await promotion.getByLabel('Nombre').fill('Segunda unidad 20%');
  await promotion.getByLabel('Descuento en segunda unidad %').fill('20');
  await promotion.locator('select[formcontrolname="productId"]').selectOption(product.id);
  await promotion.getByRole('button', { name: 'Agregar', exact: true }).click();
  await promotion.getByRole('button', { name: 'Guardar promoción' }).click();
  await expect(page.getByText('Segunda unidad 20%')).toBeVisible();
  expect(writes[1]).toMatchObject({
    path: '/promotions',
    body: {
      type: 'SECOND_UNIT_PERCENT',
      discountPercent: '20',
      products: [{ productId: product.id, quantity: '1' }],
    },
  });

  await page.getByRole('button', { name: 'Fidelidad', exact: true }).click();
  const loyalty = page.locator('.loyalty');
  await loyalty.locator('.formula').nth(0).getByLabel('Importe').fill('100.00');
  await loyalty.locator('.formula').nth(0).getByLabel('Puntos').fill('5');
  await loyalty.locator('.formula').nth(1).getByLabel('Puntos').fill('100');
  await loyalty.locator('.formula').nth(1).getByLabel('Importe').fill('10.00');
  await loyalty.getByRole('button', { name: 'Publicar nueva versión' }).click();
  await expect(page.getByText('Regla de fidelidad v1 publicada.')).toBeVisible();
  expect(writes[2]).toMatchObject({
    path: '/loyalty/rules/current',
    body: {
      active: true,
      earnAmount: '100.00',
      earnPoints: 5,
      redeemPoints: 100,
      redeemAmount: '10.00',
    },
  });
});

test('keeps the commercial workspace usable on a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockPricing(page, []);
  await page.goto('./catalogo/precios');
  await expect(page.getByRole('heading', { name: 'Precios y promociones' })).toBeVisible();
  await page.getByRole('button', { name: 'Nueva lista' }).click();
  await expect(page.getByRole('dialog', { name: 'Nueva lista' })).toBeVisible();
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});

test('keeps price management usable without exposing loyalty configuration without permission', async ({
  page,
}) => {
  await mockPricing(page, [], ['PRODUCTS_MANAGE']);
  await page.goto('./catalogo/precios');
  await expect(page.getByRole('button', { name: 'Nueva lista' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fidelidad', exact: true })).toHaveCount(0);
  await expect(page.getByText('Sin permiso')).toBeVisible();
});
