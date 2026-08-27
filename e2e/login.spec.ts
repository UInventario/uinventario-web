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
  await expect(page.getByText('Sucursal Principal · Bodega Principal · Caja Principal')).toBeVisible();
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
  await expect(page.getByText('Escribe un costo no negativo, con máximo 2 decimales.')).toBeVisible();
  await page.getByLabel('Costo').fill('85.40');
  await page.getByRole('button', { name: 'Crear producto' }).click();
  await expect(page.getByText('Producto creado')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Café molido 500 g' })).toBeVisible();
  await expect(page.locator('.detail').getByText('119.90')).toBeVisible();
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
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(page.getByText('6 producto(s)')).toBeVisible();
  await expect(page.getByText('Página 1 de 2')).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByText('Página 2 de 2')).toBeVisible();

  await page.getByLabel('Buscar por nombre, SKU o código').fill(' cafe-500 ');
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(page.getByText('1 producto(s)')).toBeVisible();
  await page.getByRole('button', { name: /Café molido 500 g/ }).click();
  await expect(page.getByText('7501234567890')).toBeVisible();
  await page.getByLabel('Buscar por nombre, SKU o código').fill('inexistente');
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(page.getByRole('heading', { name: 'Sin resultados' })).toBeVisible();
  await page.getByLabel('Buscar por nombre, SKU o código').fill('');
  await page.getByRole('button', { name: 'Buscar' }).click();

  await page.getByLabel('Nombre', { exact: true }).fill('Producto duplicado');
  await page.getByLabel('SKU', { exact: true }).fill('cafe-500');
  await page.getByLabel('Código de barras').fill('7500000000001');
  await page.getByLabel('Costo').fill('1.00');
  await page.getByLabel('Precio de venta').fill('2.00');
  await page.getByRole('button', { name: 'Crear producto' }).click();
  await expect(page.getByRole('alert')).toHaveText('Ya existe un producto con ese SKU.');

  await page.reload();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText('Sucursal Principal')).toBeVisible();
  await expect(page.getByText('Bodega Principal')).toBeVisible();
  await expect(page.getByText('Caja Principal')).toBeVisible();

  const refresh = await page.request.post('http://localhost:3000/api/v1/auth/sessions/refresh');
  expect(refresh.status()).toBe(200);
  await page.reload();
  await expect(page.getByText('Caja Principal')).toBeVisible();

  const secondTab = await context.newPage();
  await secondTab.goto('/app');
  await expect(secondTab.getByText('Caja Principal')).toBeVisible();

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
