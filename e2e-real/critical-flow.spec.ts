import { expect, test, type Page, type TestInfo } from '@playwright/test';

const password = 'SecurePass!123';

interface Account {
  readonly company: string;
  readonly email: string;
}

function account(testInfo: TestInfo, suffix: string): Account {
  const run = `${Date.now()}-${testInfo.project.name}-${suffix}`
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
  return {
    company: `Empresa E2E ${run.slice(-12)}`,
    email: `e2e-${run}@example.test`,
  };
}

async function register(page: Page, current: Account): Promise<void> {
  await page.goto('./registro');
  await page.getByLabel('Nombre de la empresa').fill(current.company);
  await page.getByLabel('Correo electr\u00f3nico').fill(current.email);
  await page.getByLabel('Contrase\u00f1a', { exact: true }).fill(password);
  await page.getByLabel('Confirma la contrase\u00f1a').fill(password);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByRole('heading', { name: 'Cuenta creada' })).toBeVisible();
}

async function login(page: Page, email: string, currentPassword = password): Promise<void> {
  await page.goto('./login');
  await page.getByLabel('Correo electr\u00f3nico').fill(email);
  await page.getByLabel('Contrase\u00f1a').fill(currentPassword);
  await page.getByRole('button', { name: 'Iniciar sesi\u00f3n' }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

async function onboard(page: Page, company: string): Promise<void> {
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel('Raz\u00f3n social').fill(`${company} SA de CV`);
  await page.getByLabel('Nombre comercial').fill(company);
  await page.getByLabel('Pa\u00eds').selectOption('MX');
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Crea tu operaci\u00f3n inicial' })).toBeVisible();
  await page.getByLabel('Zona horaria').selectOption('America/Mexico_City');
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Agrega tu primera caja' })).toBeVisible();
  await page.getByRole('button', { name: 'Finalizar configuraci\u00f3n' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Cerrar sesi\u00f3n' }).click();
  await expect(page).toHaveURL(/\/login$/);
}

async function capture(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  if (process.env['E2E_CAPTURE_VISUAL'] !== '1') return;
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: false });
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test('runs the real critical business flow with tenant, permission, money and stock safeguards', async ({
  page,
}, testInfo) => {
  test.slow();
  const admin = account(testInfo, 'admin');
  const isolated = account(testInfo, 'isolated');
  const token = `${Date.now()}${testInfo.project.name.length}`;
  const productName = `Producto real ${token}`;
  const sku = `E2E${token}`.slice(0, 40);
  const operatorEmail = `operator-${token}@example.test`;

  await register(page, admin);
  await login(page, admin.email);
  await onboard(page, admin.company);

  await page.goto('./catalogo');
  await expect(page.getByRole('heading', { name: 'Cat\u00e1logo' })).toBeVisible();
  await page.getByRole('button', { name: 'Nuevo producto' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill(productName);
  await page.getByLabel('SKU').fill(sku);
  await page.getByLabel('Costo').fill('10.00');
  await page.getByLabel('Precio').fill('25.50');
  await page.getByLabel('Impuesto').selectOption('EXEMPT');
  await page.getByRole('button', { name: 'Guardar producto' }).click();
  await expect(page.getByText(productName, { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await capture(page, testInfo, 'catalog-product');

  await page.goto('./inventario');
  await page.getByRole('button', { name: 'Registrar movimiento' }).click();
  const chooser = page.getByRole('dialog', { name: 'Selecciona un producto' });
  await expect(chooser).toBeVisible();
  await chooser.getByText(productName, { exact: true }).click();
  const movement = page.getByRole('dialog', { name: productName });
  await movement.getByLabel('Cantidad').fill('5');
  await movement.getByLabel('Raz\u00f3n').fill('Stock inicial E2E');
  await movement.getByLabel('Referencia o evidencia').fill(`E2E-${token}`);
  await movement.getByRole('button', { name: 'Registrar movimiento' }).click();
  await expect(page.getByText('Movimiento registrado. El saldo fue actualizado.')).toBeVisible();
  await expect(page.getByText('5.000', { exact: true }).first()).toBeVisible();
  await capture(page, testInfo, 'inventory-before-sale');

  await page.goto('./ventas/caja');
  await expect(page.getByRole('heading', { name: 'Abre un turno para comenzar' })).toBeVisible();
  await page.getByLabel('Fondo inicial').fill('100.00');
  await page.getByRole('button', { name: 'Abrir turno' }).click();
  await expect(page.getByRole('region', { name: 'Turno abierto' })).toBeVisible();

  await page.goto('./ventas/pos');
  const search = page.getByLabel('Buscar o escanear producto');
  await search.fill(sku);
  await search.press('Enter');
  await expect(page.getByText(productName, { exact: true }).last()).toBeVisible();
  await page.getByRole('button', { name: `Sumar cantidad de ${productName}` }).click();
  await expect(page.getByText('2.000', { exact: true })).toBeVisible();
  await expect(page.locator('.totals .total')).toContainText('$51.00');
  await capture(page, testInfo, 'pos-cart');
  await page.getByRole('button', { name: 'Continuar al cobro' }).click();
  await expect(page.getByRole('heading', { name: 'Completar venta' })).toBeVisible();
  await expect(page.getByLabel('Efectivo recibido')).toHaveValue('51.00');
  await page.getByRole('button', { name: 'Cobrar y completar venta' }).click();
  await expect(page.getByText('Venta registrada', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('$51.00');
  await capture(page, testInfo, 'sale-completed');
  await page.getByRole('button', { name: 'Iniciar otra venta' }).click();

  await page.goto(`./inventario?q=${encodeURIComponent(sku)}`);
  await expect(page.getByText(productName, { exact: true })).toBeVisible();
  await expect(page.getByText('3.000', { exact: true }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await capture(page, testInfo, 'inventory-after-sale');

  await page.goto('./administracion/accesos');
  await page.getByRole('button', { name: 'Nuevo rol' }).click();
  await page.getByLabel('Nombre del rol').fill(`Consulta ${token}`);
  await page
    .locator('.check-card')
    .filter({ hasText: 'Consultar inventario' })
    .locator('input')
    .check();
  await page.getByRole('button', { name: 'Crear rol' }).click();
  await expect(page.locator('.notice.success')).toContainText(`Consulta ${token}`);
  await page.getByRole('button', { name: 'Nuevo usuario' }).click();
  await page.getByLabel('Correo').fill(operatorEmail);
  await page.getByLabel('Contrase\u00f1a temporal').fill(password);
  await page
    .locator('.selection-card')
    .filter({ hasText: `Consulta ${token}` })
    .locator('input')
    .check();
  await page
    .locator('.selection-card')
    .filter({ hasText: 'Sucursal principal' })
    .locator('input')
    .check();
  await page.getByRole('button', { name: 'Crear usuario' }).click();
  await expect(
    page.locator('ui-access-user-table').getByText(operatorEmail, { exact: true }),
  ).toBeVisible();

  await logout(page);
  await login(page, operatorEmail);
  await page.goto('./catalogo');
  await expect(page.getByText(productName, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nuevo producto' })).toHaveCount(0);
  await page.goto('./inventario');
  await expect(page.getByRole('button', { name: 'Registrar movimiento' })).toHaveCount(0);

  await logout(page);
  await register(page, isolated);
  await login(page, isolated.email);
  await onboard(page, isolated.company);
  await page.goto('./catalogo');
  await page.getByLabel('Buscar productos').fill(sku);
  await page.getByRole('button', { name: 'Aplicar' }).click();
  await expect(page.getByText(productName, { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'No encontramos productos' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
