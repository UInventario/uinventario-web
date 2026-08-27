import { expect, test } from '@playwright/test';

const oldPassword = 'Correcta-2026!';
const newPassword = 'Nueva-Correcta-2026!';

test('requests and completes a one-use password reset from the UI', async ({ page }, testInfo) => {
  const email = `reset-${testInfo.project.name}-${Date.now()}@example.com`;
  await page.goto('/registro');
  await page.getByLabel('Nombre de la organización').fill('Tienda Recuperación');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(oldPassword);
  await page.getByLabel('Confirma la contraseña').fill(oldPassword);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click();
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByRole('button', { name: 'Enviar instrucciones' }).click();
  await expect(page.getByRole('status')).toContainText('Si existe una cuenta con ese correo');

  const mailboxResponse = await page.request.get(
    `http://localhost:3000/api/v1/auth/password-resets/local-mailbox?email=${encodeURIComponent(email)}`,
  );
  expect(mailboxResponse.status()).toBe(200);
  const mailbox = (await mailboxResponse.json()) as { data: { resetUrl: string } };

  await page.goto(mailbox.data.resetUrl);
  await page.getByLabel('Contraseña nueva', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirmar contraseña').fill(newPassword);
  await page.getByRole('button', { name: 'Actualizar contraseña' }).click();
  await expect(page.getByRole('status')).toHaveText('Tu contraseña fue actualizada correctamente.');
  await page.screenshot({
    path: testInfo.outputPath('password-reset-success.png'),
    fullPage: true,
  });

  await page.goto(mailbox.data.resetUrl);
  await page.getByLabel('Contraseña nueva', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirmar contraseña').fill(newPassword);
  await page.getByRole('button', { name: 'Actualizar contraseña' }).click();
  await expect(page.getByRole('alert')).toContainText('El enlace no es válido o expiró');

  await page.getByRole('link', { name: 'Solicitar un enlace nuevo' }).click();
  await expect(page).toHaveURL(/\/recuperar$/);
  await page.goto('/login');
  await expect(page).toHaveURL(/\/login$/);
  const login = page.locator('app-login-page');
  await expect(login.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  await login.getByLabel('Correo electrónico').fill(email);
  await login.getByLabel('Contraseña').fill(newPassword);
  await login.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
});
