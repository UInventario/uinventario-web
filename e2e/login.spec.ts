import { expect, test } from '@playwright/test';

const password = 'Correcta-2026!';

async function createAccount(page: import('@playwright/test').Page, email: string): Promise<void> {
  await page.goto('/registro');
  await page.getByLabel('Nombre de la organización').fill('Tienda Login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByLabel('Confirma la contraseña').fill(password);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page).toHaveURL(/\/login$/);
}

test('logs in, reaches onboarding and restores the session after reload', async ({
  page,
  context,
}, testInfo) => {
  const email = `login-${testInfo.project.name}-${Date.now()}@example.com`;
  await createAccount(page, email);

  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();

  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole('heading', { name: 'Prepara Tienda Login' })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  await expect(page.getByText('Escribe el nombre legal de la empresa.')).toBeVisible();

  await page.getByLabel('Nombre legal').fill('Tienda Login, S.A. de C.V.');
  await expect(page.getByLabel('Nombre comercial')).toHaveValue('Tienda Login');
  await page.getByLabel('País').selectOption('MX');
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  await expect(page.getByText('Empresa configurada. Crea la sucursal inicial.')).toBeVisible();

  await expect(page.getByLabel('Nombre de la sucursal')).toHaveValue('Sucursal Principal');
  await page.getByLabel('Zona horaria').fill('America/Mexico_City');
  await page.getByRole('button', { name: 'Crear sucursal y bodega' }).click();
  await expect(
    page.getByText('Sucursal y bodega listas. Crea la caja inicial para comenzar a operar.'),
  ).toBeVisible();

  await page.goto('/app');
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByLabel('Nombre de la caja')).toHaveValue('Caja Principal');
  await page.getByLabel('Nombre de la caja').fill('');
  await page.getByRole('button', { name: 'Crear caja y comenzar' }).click();
  await expect(page.getByText('Escribe el nombre de la caja.')).toBeVisible();
  await page.getByLabel('Nombre de la caja').fill('Caja Principal');
  await page.screenshot({
    path: testInfo.outputPath('initial-register-step.png'),
    fullPage: true,
  });

  await page.getByRole('button', { name: 'Crear caja y comenzar' }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('heading', { name: 'Productos', exact: true })).toBeVisible();
  await expect(page.locator('.context').first()).toContainText(
    'Sucursal Principal · Bodega Principal · Caja Principal',
  );
  const coreNavigation = page.getByRole('navigation', { name: 'Módulos principales' });
  await expect(coreNavigation.getByRole('link')).toHaveCount(7);
  const productLink = coreNavigation.getByRole('link', { name: 'Productos' });
  const inventoryLink = coreNavigation.getByRole('link', { name: 'Inventario' });
  await productLink.focus();
  await expect(productLink).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(inventoryLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/app#stock-overview-title$/);
  await expect(page.getByRole('heading', { name: 'Existencias reales' })).toBeInViewport();

  await coreNavigation.getByRole('link', { name: 'Empresa' }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole('heading', { name: 'Administra Tienda Login' })).toBeVisible();
  await expect(page.getByLabel('Nombre legal')).toHaveValue('Tienda Login, S.A. de C.V.');
  await page.getByRole('button', { name: 'Guardar empresa' }).click();
  await expect(page.getByRole('status')).toHaveText('Datos de empresa guardados.');
  await page.getByRole('link', { name: 'Volver a operación' }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.screenshot({
    path: testInfo.outputPath('operational-context.png'),
    fullPage: true,
  });

  await page.getByLabel('Nombre', { exact: true }).fill('Café molido 500 g');
  await page.getByLabel('SKU', { exact: true }).fill('CAFE-500');
  await page.getByLabel('Código de barras').fill('7501234567890');
  await page.getByLabel('Categoría').fill('Abarrotes');
  await page.getByLabel('Marca').fill('Casa');
  await page.getByLabel('Costo').fill('-1');
  await page.getByLabel('Precio de venta').fill('119.90');
  await page.getByRole('button', { name: 'Crear producto' }).click();
  await expect(
    page.getByText('Escribe un costo no negativo, con máximo 2 decimales.'),
  ).toBeVisible();
  await page.getByLabel('Costo').fill('85.40');
  await page.getByRole('button', { name: 'Crear producto' }).click();
  await expect(
    page.getByLabel('Catálogo real').getByText('Producto creado'),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Café molido 500 g' })).toBeVisible();
  await expect(page.locator('.detail').getByText('119.90')).toBeVisible();
  await page.getByRole('button', { name: 'Editar producto' }).click();
  await expect(page.getByRole('heading', { name: 'Editar producto' })).toBeVisible();
  await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('Café molido 500 g');
  await page.getByLabel('Costo').fill('86.00');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(
    page.getByLabel('Catálogo real').getByText('Producto actualizado'),
  ).toBeVisible();
  await expect(page.locator('.detail').getByText('86.00')).toBeVisible();
  await expect(page.locator('.balance').getByText('0.000')).toBeVisible();
  await page.getByLabel('Cantidad').fill('10.5');
  await page.getByLabel('Motivo').fill('Conteo inicial');
  await page.getByLabel('Referencia').fill('CONTEO-001');
  await page.getByRole('button', { name: 'Registrar movimiento' }).click();
  await expect(page.getByRole('status')).toContainText('Existencia 10.500');
  await expect(page.locator('.balance').getByText('10.500')).toBeVisible();
  const stockOverview = page.locator('.stock-overview:not(.movement-history)');
  await expect(stockOverview.getByRole('heading', { name: 'Existencias reales' })).toBeVisible();
  await expect(stockOverview.getByText('CAFE-500')).toBeVisible();
  await expect(stockOverview.getByText('10.500').first()).toBeVisible();
  const movementHistory = page.locator('.movement-history');
  await expect(
    movementHistory.getByRole('heading', { name: 'Historial de movimientos' }),
  ).toBeVisible();
  await expect(movementHistory.getByText('Conteo inicial')).toBeVisible();
  await expect(movementHistory.getByText('Entrada 10.500')).toBeVisible();
  await expect(movementHistory.getByText(email)).toBeVisible();
  await page.getByLabel('Filtrar producto por nombre, SKU o código').fill('sin-stock');
  await page.getByRole('button', { name: 'Filtrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sin existencias para mostrar' })).toBeVisible();
  await page.getByLabel('Filtrar producto por nombre, SKU o código').fill('cafe-500');
  await page.getByRole('button', { name: 'Filtrar', exact: true }).click();
  await expect(stockOverview.getByText('CAFE-500')).toBeVisible();
  const pos = page.locator('.pos-workspace');
  await pos.getByLabel('Buscar producto para venta por nombre, SKU o código').fill('7501234567890');
  await pos.getByRole('button', { name: 'Buscar' }).click();
  await pos.getByRole('button', { name: 'Agregar' }).click();
  await expect(pos.getByText('Carrito validado y listo para cobrar')).toBeVisible();
  await expect(pos.getByText('MXN 119.90')).toBeVisible();
  const saleQuantity = pos.getByLabel('Cantidad de Café molido 500 g');
  await saleQuantity.fill('20');
  await saleQuantity.blur();
  await expect(pos.getByRole('alert')).toHaveText(
    'No hay existencia suficiente para esa cantidad.',
  );
  await saleQuantity.fill('2');
  await saleQuantity.blur();
  await expect(pos.getByText('MXN 239.80')).toBeVisible();
  await expect(pos.getByText('MXN 33.08')).toBeVisible();
  await pos.getByLabel('Efectivo recibido').fill('250.00');
  await pos.getByRole('button', { name: 'Cobrar en efectivo' }).click();
  await expect(pos.getByText(/Venta V-[A-F0-9]{12} completada/)).toBeVisible();
  await expect(pos.getByText(/Cambio MXN\s+10\.20/)).toBeVisible();
  await expect(stockOverview.getByText('8.500').first()).toBeVisible();
  await movementHistory.getByLabel('Tipo').selectOption('SALE');
  await movementHistory.getByRole('button', { name: 'Filtrar movimientos' }).click();
  await expect(movementHistory.getByText('Salida -2.000')).toBeVisible();
  await expect(movementHistory.getByText(/Venta V-/)).toBeVisible();
  await movementHistory.getByLabel('Desde').fill('2099-01-01');
  await movementHistory.getByRole('button', { name: 'Filtrar movimientos' }).click();
  await expect(
    movementHistory.getByRole('heading', { name: 'Sin movimientos para mostrar' }),
  ).toBeVisible();
  await movementHistory.getByLabel('Desde').fill('');
  await movementHistory.getByLabel('Tipo').selectOption('');
  await movementHistory.getByRole('button', { name: 'Filtrar movimientos' }).click();
  const salesHistory = page.locator('.sales-workspace');
  await expect(salesHistory.getByRole('heading', { name: 'Historial de ventas' })).toBeVisible();
  const saleHistoryRow = salesHistory.getByRole('button', { name: /Abrir venta V-/ });
  await expect(saleHistoryRow).toBeVisible();
  await saleHistoryRow.click();
  await expect(salesHistory.getByText('Movimientos de inventario')).toBeVisible();
  await expect(salesHistory.getByText('-2.000 → 8.500')).toBeVisible();
  await salesHistory.getByLabel('Desde').fill('2099-01-01');
  await salesHistory.getByRole('button', { name: 'Filtrar ventas' }).click();
  await expect(
    salesHistory.getByRole('heading', { name: 'Sin ventas para mostrar' }),
  ).toBeVisible();
  await salesHistory.getByLabel('Desde').fill('');
  await salesHistory.getByRole('button', { name: 'Filtrar ventas' }).click();
  await expect(salesHistory.getByRole('button', { name: /Abrir venta V-/ })).toBeVisible();
  const auditLog = page.locator('.audit-log');
  await expect(auditLog.getByRole('heading', { name: 'Auditoría Core' })).toBeVisible();
  await expect(auditLog.getByText('Venta completada')).toBeVisible();
  await expect(auditLog.getByText(email).first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('pos-cart.png'), fullPage: true });
  await page.screenshot({
    path: testInfo.outputPath('product-created.png'),
    fullPage: true,
  });

  for (let index = 1; index <= 5; index += 1) {
    const response = await page.request.post('http://localhost:3000/api/v1/products', {
      data: {
        name: `Producto ${index}`,
        sku: `PRODUCT-${index}`,
        cost: '1.00',
        price: '2.00',
      },
    });
    expect(response.status()).toBe(201);
  }
  const catalog = page.locator('aside');
  await catalog.getByRole('button', { name: 'Buscar' }).click();
  await expect(page.getByText('6 producto(s)')).toBeVisible();
  await expect(page.getByText('Página 1 de 2')).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByText('Página 2 de 2')).toBeVisible();

  await page.getByLabel('Buscar por nombre, SKU o código').fill(' cafe-500 ');
  await catalog.getByRole('button', { name: 'Buscar' }).click();
  await expect(catalog.getByText('1 producto(s)')).toBeVisible();
  await page.getByRole('button', { name: /Café molido 500 g/ }).click();
  await expect(page.getByText('7501234567890')).toBeVisible();
  await expect(page.locator('.balance').getByText('8.500')).toBeVisible();
  await page.getByLabel('Buscar por nombre, SKU o código').fill('inexistente');
  await catalog.getByRole('button', { name: 'Buscar' }).click();
  await expect(page.getByRole('heading', { name: 'Sin resultados' })).toBeVisible();
  await page.getByLabel('Buscar por nombre, SKU o código').fill('');
  await catalog.getByRole('button', { name: 'Buscar' }).click();

  await page.getByLabel('Nombre', { exact: true }).fill('Producto duplicado');
  await page.getByLabel('SKU', { exact: true }).fill('cafe-500');
  await page.getByLabel('Código de barras').fill('7500000000001');
  await page.getByLabel('Costo').fill('1.00');
  await page.getByLabel('Precio de venta').fill('2.00');
  await page.getByRole('button', { name: 'Crear producto' }).click();
  await expect(page.getByRole('alert')).toHaveText('Ya existe un producto con ese SKU.');

  await page.reload();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.locator('.context').first()).toContainText(
    'Sucursal Principal · Bodega Principal · Caja Principal',
  );

  const refresh = await page.request.post('http://localhost:3000/api/v1/auth/sessions/refresh');
  expect(refresh.status()).toBe(200);
  await page.reload();
  await expect(page.locator('.context').first()).toContainText('Caja Principal');

  const secondTab = await context.newPage();
  await secondTab.goto('/app');
  await expect(secondTab.locator('.context').first()).toContainText('Caja Principal');

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(secondTab).toHaveURL(/\/login$/);

  await page.goto('/app');
  await expect(page).toHaveURL(/\/login\?returnUrl=%2Fapp$/);
});

test('protects private routes and reports invalid credentials generically', async ({ page }) => {
  await page.goto('/onboarding');
  await expect(page).toHaveURL(/\/login\?returnUrl=%2Fonboarding$/);

  await page.getByLabel('Correo electrónico').fill('unknown@example.com');
  await page.getByLabel('Contraseña').fill('Incorrecta!');
  await page.getByRole('button', { name: 'Ingresar' }).click();

  await expect(page.getByRole('alert')).toHaveText('El correo o la contraseña no son válidos.');
  await expect(page).toHaveURL(/\/login\?returnUrl=%2Fonboarding$/);
});
