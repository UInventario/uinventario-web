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
  await expect(
    page.getByText('Empresa configurada. El siguiente paso es crear la sucursal inicial.'),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('company-configured.png'), fullPage: true });

  await page.reload();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByLabel('Nombre legal')).toHaveValue('Tienda Login, S.A. de C.V.');
  await expect(page.getByLabel('País')).toHaveValue('MX');

  const refresh = await page.request.post('http://localhost:3000/api/v1/auth/sessions/refresh');
  expect(refresh.status()).toBe(200);
  await page.reload();
  await expect(page.getByText(email)).toBeVisible();

  const secondTab = await context.newPage();
  await secondTab.goto('/onboarding');
  await expect(secondTab.getByText(email)).toBeVisible();

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(secondTab).toHaveURL(/\/login$/);

  await page.goto('/onboarding');
  await expect(page).toHaveURL(/\/login\?returnUrl=%2Fonboarding$/);
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
