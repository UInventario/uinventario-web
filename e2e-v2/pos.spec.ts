import { expect, test } from '@playwright/test';
import { mockPos, product } from './pos.fixtures';

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

test('applies contextual prices, authorized discounts, explained promotions and confirmed loyalty', async ({
  page,
}) => {
  const requests: Array<Record<string, unknown>> = [];
  await mockPos(page, { quoteRequests: requests });
  await page.goto('./ventas/pos');
  await page.getByRole('button', { name: 'Agregar Café molido' }).click();

  await page.getByRole('button', { name: 'Cliente y beneficios' }).click();
  const benefits = page.getByRole('dialog', { name: 'Cliente, descuento y puntos' });
  await benefits.getByPlaceholder('Nombre, identificador o contacto').fill('Cliente');
  await benefits.getByRole('button', { name: 'Buscar' }).click();
  await benefits.getByRole('button', { name: /Cliente preferente/ }).click();
  await benefits.getByLabel('Aplicar descuento a la venta').check();
  await benefits.getByLabel('Valor').fill('10');
  await benefits.getByLabel('Motivo').fill('Convenio de cliente preferente');
  await benefits.getByLabel('Puntos a canjear').fill('100');
  await benefits.getByLabel(/Confirmo el canje de 100 puntos/).check();
  await benefits.getByRole('button', { name: 'Aplicar y recalcular' }).click();

  await expect(page.getByText('Preferente Centro')).toBeVisible();
  await expect(page.getByText(/Promoción Cliente frecuente aplicada por contexto/)).toBeVisible();
  await expect(page.getByText('Descuento de venta')).toBeVisible();
  await expect(page.getByText(/Ganará 5 pts/)).toBeVisible();
  await expect
    .poll(() => requests.at(-1))
    .toMatchObject({
      channel: 'POS',
      customerId: 'customer-1',
      loyaltyPointsToRedeem: 100,
      discount: { type: 'PERCENT', value: '10', reason: 'Convenio de cliente preferente' },
    });

  await page.getByRole('button', { name: 'Editar Café molido' }).click();
  const line = page.getByRole('dialog', { name: 'Café molido' });
  await line.getByLabel('Aplicar descuento a esta línea').check();
  await line.getByLabel('Valor').fill('5');
  await line.getByLabel('Motivo del descuento').fill('Producto con convenio');
  await line.getByRole('button', { name: 'Aplicar cambios' }).click();
  await expect
    .poll(() => (requests.at(-1)?.['lines'] as Array<Record<string, unknown>> | undefined)?.[0])
    .toMatchObject({
      discount: { type: 'PERCENT', value: '5', reason: 'Producto con convenio' },
    });
});

test('removes persisted overrides and discounts when the cashier lacks permissions', async ({
  page,
}) => {
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
      discount: { type: 'PERCENT', value: '50', reason: 'Persistido anteriormente' },
    },
  );
  await mockPos(page, { permissions: ['SALES_MANAGE'], quoteWrites: writes });
  await page.goto('./ventas/pos');

  await expect(page.getByText('Café molido', { exact: true }).last()).toBeVisible();
  await page.getByRole('button', { name: 'Editar Café molido' }).click();
  await expect(page.getByLabel('Precio manual')).toHaveCount(0);
  await expect(page.getByLabel('Aplicar descuento a esta línea')).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect.poll(() => writes.at(-1)?.[0]).not.toHaveProperty('manualUnitPrice');
  expect(writes.at(-1)?.[0]).not.toHaveProperty('discount');
  await page.getByRole('button', { name: 'Cliente y beneficios' }).click();
  await expect(page.getByLabel('Aplicar descuento a la venta')).toHaveCount(0);
});
