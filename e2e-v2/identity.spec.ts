import { expect, test } from '@playwright/test';

const validPassword = 'SecurePass!123';
const validToken = 'a'.repeat(43);

test('registers a company and first administrator', async ({ page }) => {
  let idempotencyKey = '';
  await page.route('**/api/v1/auth/registrations', async (route) => {
    idempotencyKey = route.request().headers()['idempotency-key'] ?? '';
    expect(route.request().postDataJSON()).toEqual({
      organizationName: 'Tienda Central',
      email: 'admin@example.com',
      password: validPassword,
    });
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          tenant: { id: 'tenant-1', name: 'Tienda Central' },
          user: { id: 'user-1', email: 'admin@example.com' },
          nextStep: 'LOGIN',
        },
        meta: { apiVersion: '1' },
      }),
    });
  });

  await page.goto('./registro');
  await page.getByLabel('Nombre de la empresa').fill('Tienda Central');
  await page.getByLabel('Correo electrónico').fill('Admin@Example.COM');
  await page.getByLabel('Contraseña', { exact: true }).fill(validPassword);
  await page.getByLabel('Confirma la contraseña').fill(validPassword);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  await expect(page.getByRole('heading', { name: 'Cuenta creada' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
    'href',
    '/v2/login',
  );
  expect(idempotencyKey).toMatch(/^registration:[\w-]{36}$/);
});

test('shows actionable registration validation and duplicate errors', async ({ page }) => {
  await page.route('**/api/v1/auth/registrations', async (route) => {
    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'REGISTRATION_NOT_AVAILABLE',
        message: 'No fue posible crear la cuenta con los datos proporcionados.',
      }),
    });
  });

  await page.goto('./registro');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByText('Escribe un nombre de 2 a 120 caracteres.')).toBeVisible();
  await expect(page.getByText('Escribe un correo electrónico válido.')).toBeVisible();

  await page.getByLabel('Nombre de la empresa').fill('Tienda Central');
  await page.getByLabel('Correo electrónico').fill('admin@example.com');
  await page.getByLabel('Contraseña', { exact: true }).fill(validPassword);
  await page.getByLabel('Confirma la contraseña').fill(validPassword);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByRole('alert')).toContainText('Si ya te registraste');
});

test('requests and completes password recovery without account enumeration', async ({ page }) => {
  await page.route('**/api/v1/auth/password-resets', async (route) => {
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ data: { accepted: true }, meta: { apiVersion: '1' } }),
    });
  });
  await page.goto('./recuperar');
  await page.getByLabel('Correo electrónico').fill('unknown@example.com');
  await page.getByRole('button', { name: 'Enviar instrucciones' }).click();
  await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Si existe una cuenta');

  await page.route('**/api/v1/auth/password-resets/complete', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ token: validToken, password: validPassword });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { reset: true }, meta: { apiVersion: '1' } }),
    });
  });
  await page.goto(`./restablecer?token=${validToken}`);
  await page.getByLabel('Contraseña nueva', { exact: true }).fill(validPassword);
  await page.getByLabel('Confirma la contraseña').fill(validPassword);
  await page.getByRole('button', { name: 'Actualizar contraseña' }).click();
  await expect(page.getByRole('heading', { name: 'Contraseña actualizada' })).toBeVisible();
});

test('handles invalid, expired or already used recovery links', async ({ page }) => {
  await page.goto('./restablecer?token=invalid');
  await expect(page.getByRole('heading', { name: 'Enlace no disponible' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('inválido, ya fue utilizado o expiró');

  await page.route('**/api/v1/auth/password-resets/complete', async (route) => {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'INVALID_PASSWORD_RESET_TOKEN',
        message: 'El enlace de recuperación no es válido o expiró.',
      }),
    });
  });
  await page.goto(`./restablecer?token=${validToken}`);
  await page.getByLabel('Contraseña nueva', { exact: true }).fill(validPassword);
  await page.getByLabel('Confirma la contraseña').fill(validPassword);
  await page.getByRole('button', { name: 'Actualizar contraseña' }).click();
  await expect(page.getByRole('heading', { name: 'Enlace no disponible' })).toBeVisible();
});
