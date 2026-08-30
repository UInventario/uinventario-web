import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

const initialSupplier = {
  id: '57b74392-2a7d-4e65-88d3-5b40d7f4f027',
  legalName: 'Distribuidora Norte SA',
  tradeName: 'Norte',
  countryCode: 'MX',
  identifierType: 'RFC',
  taxIdentifier: 'DIN010203AB1',
  active: true,
  version: 1,
  contacts: [
    {
      id: 'contact-1',
      name: 'Ana Compras',
      email: 'ana@example.com',
      phone: null,
      role: 'Ventas',
      primary: true,
    },
  ],
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-30T00:00:00.000Z',
};

const catalogProduct = {
  id: 'a9766220-d36e-44da-9ea1-6d88471073a1',
  name: 'Café molido 500 g',
  sku: 'CAFE-500',
  cost: '85.00',
  price: '120.00',
  baseUnit: 'UNIT',
  quantityPrecision: 0,
  minimumQuantity: '1',
};

function session() {
  return {
    data: {
      user: {
        id: 'admin-1',
        email: 'admin@example.com',
        roles: ['ADMIN'],
        permissions: ['SUPPLIERS_MANAGE'],
      },
      tenant: { id: 'tenant-1', name: 'Tienda Central' },
      context: { branch: null, warehouse: null, cashRegister: null },
      nextStep: 'APPLICATION',
    },
    meta: {
      apiVersion: '1',
      sessionExpiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    },
  };
}

async function json(route: Route, data: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
}

async function mockSuppliers(page: Page) {
  let suppliers = [initialSupplier];
  let links: Array<Record<string, unknown>> = [];
  const writes: Array<{ path: string; method: string; body?: Record<string, unknown> }> = [];

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    const method = request.method();
    if (path === '/auth/sessions/current') return json(route, session());
    if (path === '/suppliers' && method === 'GET') {
      const status = url.searchParams.get('status') ?? 'ACTIVE';
      const data = suppliers.filter(
        (supplier) => status === 'ALL' || supplier.active === (status === 'ACTIVE'),
      );
      return json(route, {
        data,
        meta: {
          apiVersion: '1',
          pagination: { page: 1, pageSize: 20, total: data.length, totalPages: 1 },
        },
      });
    }
    if (path === '/suppliers' && method === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      const created = {
        ...body,
        id: '33d4121d-1bea-4694-8e55-6ea7710545cc',
        tradeName: body['tradeName'] ?? null,
        countryCode: 'MX',
        identifierType: 'RFC',
        active: true,
        version: 1,
        contacts: (body['contacts'] as Array<Record<string, unknown>>).map((contact, index) => ({
          ...contact,
          id: `created-contact-${index}`,
          email: contact['email'] ?? null,
          phone: contact['phone'] ?? null,
          role: contact['role'] ?? null,
        })),
        createdAt: '2026-08-30T00:00:00.000Z',
        updatedAt: '2026-08-30T00:00:00.000Z',
      };
      suppliers = [...suppliers, created as typeof initialSupplier];
      writes.push({ path, method, body });
      return json(route, { data: created, meta: { apiVersion: '1' } }, 201);
    }
    const supplierMatch = path.match(/^\/suppliers\/([^/]+)$/);
    if (supplierMatch && method === 'GET') {
      return json(route, {
        data: suppliers.find((supplier) => supplier.id === supplierMatch[1]),
        meta: { apiVersion: '1' },
      });
    }
    if (supplierMatch && method === 'DELETE') {
      suppliers = suppliers.map((supplier) =>
        supplier.id === supplierMatch[1] ? { ...supplier, active: false } : supplier,
      );
      writes.push({ path, method });
      return json(route, {
        data: suppliers.find((supplier) => supplier.id === supplierMatch[1]),
        meta: { apiVersion: '1' },
      });
    }
    if (path === '/products' && method === 'GET') {
      return json(route, {
        data: [catalogProduct],
        meta: {
          apiVersion: '1',
          pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        },
      });
    }
    if (path === '/supplier-products' && method === 'GET') {
      return json(route, {
        data: links,
        meta: {
          apiVersion: '1',
          pagination: { page: 1, pageSize: 10, total: links.length, totalPages: 1 },
        },
      });
    }
    if (path === '/supplier-products' && method === 'POST') {
      const body = request.postDataJSON() as Record<string, string>;
      const supplier = suppliers.find((candidate) => candidate.id === body['supplierId'])!;
      const created = {
        id: 'be12eca2-b484-4f60-86d1-7068aa781ac5',
        supplier: { id: supplier.id, name: supplier.legalName },
        product: {
          id: catalogProduct.id,
          name: catalogProduct.name,
          sku: catalogProduct.sku,
          catalogCost: catalogProduct.cost,
          catalogPrice: catalogProduct.price,
          baseUnit: catalogProduct.baseUnit,
          quantityPrecision: catalogProduct.quantityPrecision,
          minimumQuantity: catalogProduct.minimumQuantity,
        },
        supplierCode: body['supplierCode'],
        minimumQuantity: body['minimumQuantity'] ?? null,
        active: true,
        version: 1,
        prices: [
          {
            id: 'price-1',
            currency: body['currency'],
            unitCost: body['unitCost'],
            validFrom: body['validFrom'],
            validTo: body['validTo'] ?? null,
            createdAt: '2026-08-30T00:00:00.000Z',
          },
        ],
        createdAt: '2026-08-30T00:00:00.000Z',
        updatedAt: '2026-08-30T00:00:00.000Z',
      };
      links = [created];
      writes.push({ path, method, body });
      return json(route, { data: created, meta: { apiVersion: '1' } }, 201);
    }
    const linkMatch = path.match(/^\/supplier-products\/([^/]+)$/);
    if (linkMatch && method === 'GET') {
      return json(route, { data: links[0], meta: { apiVersion: '1' } });
    }
    if (linkMatch && method === 'PATCH') {
      const body = request.postDataJSON() as Record<string, string>;
      const current = links[0];
      links = [
        {
          ...current,
          supplierCode: body['supplierCode'],
          minimumQuantity: body['minimumQuantity'] ?? null,
          version: 2,
          prices: [
            {
              id: 'price-2',
              currency: body['currency'],
              unitCost: body['unitCost'],
              validFrom: body['validFrom'],
              validTo: body['validTo'] ?? null,
              createdAt: '2026-08-30T00:00:00.000Z',
            },
          ],
        },
      ];
      writes.push({ path, method, body });
      return json(route, { data: links[0], meta: { apiVersion: '1' } });
    }
    return json(route, { message: `Unhandled ${method} ${path}` }, 404);
  });

  return writes;
}

test('manages suppliers, contacts and product costs in one focused workspace', async ({
  page,
}, testInfo) => {
  const writes = await mockSuppliers(page);
  await page.goto('./compras/proveedores?q=norte&status=ALL');

  await expect(page.getByRole('heading', { name: 'Proveedores' })).toBeVisible();
  await page.getByRole('button', { name: 'Nuevo proveedor' }).click();
  await page.getByLabel('Razón social').fill('Comercial Norte SA');
  await page.getByLabel('Nombre comercial').fill('Norte Comercial');
  await page.getByLabel('Identificación fiscal').fill('CNO010203AB1');
  await page.locator('#supplierContactName0').fill('María Ventas');
  await page.locator('#supplierContactEmail0').fill('maria@example.com');
  await page.getByRole('button', { name: 'Agregar' }).click();
  await page.locator('#supplierContactName1').fill('Luis Logística');
  await page.locator('#supplierContactPhone1').fill('+52 555 010 2000');
  await page.getByRole('button', { name: 'Guardar proveedor' }).click();

  await expect(page.getByText('Proveedor creado.')).toBeVisible();
  const detail = page.getByLabel('Detalle del proveedor');
  await expect(detail.getByText('María Ventas', { exact: true })).toBeVisible();
  await expect(detail.getByText('Luis Logística', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('supplier-contacts.png') });
  await expect(page).toHaveURL(/q=norte/);
  await expect(page).toHaveURL(/status=ALL/);

  await page.getByRole('button', { name: 'Productos y costos' }).click();
  await page.getByRole('button', { name: 'Asignar producto' }).click();
  await page.getByRole('option', { name: /Café molido 500 g/ }).click();
  await page.getByLabel('Código del proveedor').fill('PROV-CAFE-01');
  await page.getByLabel('Compra mínima').fill('6');
  await page.getByRole('button', { name: 'Asignar producto' }).last().click();

  await expect(page.getByText('Producto asignado.')).toBeVisible();
  await expect(page.getByText('PROV-CAFE-01')).toBeVisible();
  await page.getByRole('button', { name: 'Editar relación de Café molido 500 g' }).click();
  const createProductWrite = writes.find(
    (write) => write.path === '/supplier-products' && write.method === 'POST',
  )!;
  const originalValidFrom = createProductWrite.body!['validFrom'] as string;
  const newValidity = page.getByLabel('Nueva vigencia desde');
  const proposedValidFrom = await newValidity.inputValue();
  expect(proposedValidFrom > originalValidFrom).toBeTruthy();
  await page.getByLabel('Costo unitario').fill('82.50');
  await newValidity.fill(originalValidFrom);
  await page.getByRole('button', { name: 'Actualizar relación' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(
    page.getByText('Selecciona un producto y revisa código, costo, moneda y vigencia.'),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('supplier-product-validity.png') });
  await newValidity.fill(proposedValidFrom);
  await page.getByRole('button', { name: 'Actualizar relación' }).click();
  await expect(page.getByText('82.50 MXN')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('supplier-products.png') });
  const denseDimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(denseDimensions.documentWidth).toBe(denseDimensions.viewportWidth);

  await page.getByRole('button', { name: 'Retirar' }).click();
  const retirement = page.getByRole('alertdialog');
  const retire = retirement.getByRole('button', { name: 'Retirar proveedor' });
  await retirement.getByLabel(/Escribe Comercial Norte SA/).fill('Norte Comercial');
  await expect(retire).toBeDisabled();
  await retirement.getByLabel(/Escribe Comercial Norte SA/).fill('Comercial Norte SA');
  await page.screenshot({ path: testInfo.outputPath('supplier-retirement.png') });
  await retire.click();
  await expect(page.getByText('Proveedor retirado;')).toBeVisible();
  await expect(page.getByText('Retirado', { exact: true })).toBeVisible();

  expect(writes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ path: '/suppliers', method: 'POST' }),
      expect.objectContaining({ path: '/supplier-products', method: 'POST' }),
      expect.objectContaining({
        path: '/supplier-products/be12eca2-b484-4f60-86d1-7068aa781ac5',
        method: 'PATCH',
      }),
      expect.objectContaining({
        path: '/suppliers/33d4121d-1bea-4694-8e55-6ea7710545cc',
        method: 'DELETE',
      }),
    ]),
  );
});

test('keeps the supplier workspace usable on mobile', async ({ page }, testInfo) => {
  await mockSuppliers(page);
  await page.goto(`./compras/proveedores?supplier=${initialSupplier.id}`);
  await expect(page.getByRole('heading', { name: 'Proveedores' })).toBeVisible();
  await expect(
    page.getByLabel('Detalle del proveedor').getByText('Ana Compras', { exact: true }),
  ).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.documentWidth).toBe(dimensions.viewportWidth);
  await page.screenshot({ path: testInfo.outputPath('supplier-mobile-workspace.png') });
  const back = page.getByRole('button', { name: 'Volver a proveedores' });
  if (testInfo.project.name === 'mobile-chromium') await expect(back).toBeVisible();
  else await expect(back).toBeHidden();

  await page.getByRole('button', { name: 'Editar' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box?.width).toBeLessThanOrEqual(dimensions.viewportWidth);
  await page.screenshot({ path: testInfo.outputPath('suppliers-mobile.png') });
  if (testInfo.project.name === 'mobile-chromium') {
    await dialog.getByRole('button', { name: 'Cerrar' }).click();
    await back.click();
    await expect(page.locator('ui-supplier-list')).toBeVisible();
    await expect(page).not.toHaveURL(/supplier=/);
  }
});
