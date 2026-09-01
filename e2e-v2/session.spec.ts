import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const sessionResponse = (
  expiresAt = new Date(Date.now() + 60 * 60_000).toISOString(),
  nextStep: 'ONBOARDING' | 'APPLICATION' = 'APPLICATION',
) => ({
  data: {
    user: {
      id: 'user-1',
      email: 'admin@example.com',
      roles: ['ADMIN'],
      permissions: ['SALES_MANAGE'],
    },
    tenant: { id: 'tenant-1', name: 'Tienda Central' },
    context: {
      branch: { id: 'branch-1', name: 'Principal' },
      warehouse: { id: 'warehouse-1', name: 'Bodega' },
      cashRegister: { id: 'register-1', name: 'Caja', code: 'CAJA-1' },
    },
    nextStep,
  },
  meta: { apiVersion: '1', sessionExpiresAt: expiresAt },
});

async function completeLogin(page: Page): Promise<void> {
  await page.getByLabel('Correo electrónico').fill(' Admin@Example.COM ');
  await page.getByLabel('Contraseña').fill('SecurePass!123');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

test('authenticates into the authorized workspace without persisting tokens', async ({ page }) => {
  let requestBody: unknown;
  await page.route('**/api/v1/auth/sessions', async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sessionResponse()),
    });
  });

  await page.goto('./login');
  await completeLogin(page);

  await expect(page).toHaveURL((url) => url.pathname.endsWith('/v2/dashboard/resumen'));
  await expect(page.getByText('Tienda Central')).toHaveText('Tienda Central');
  expect(requestBody).toEqual({ email: 'admin@example.com', password: 'SecurePass!123' });
  const browserStorage = await page.evaluate(() => ({
    local: Object.entries(localStorage),
    session: Object.entries(sessionStorage),
  }));
  expect(JSON.stringify(browserStorage)).not.toMatch(/token|SecurePass/i);
});

test('shows one safe error for invalid credentials', async ({ page }) => {
  await page.route('**/api/v1/auth/sessions', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'INVALID_CREDENTIALS',
        message: 'No fue posible autenticar con las credenciales proporcionadas.',
      }),
    });
  });

  await page.goto('./login');
  await completeLogin(page);
  await expect(page.getByRole('alert')).toHaveText('El correo o la contraseña no son válidos.');
});

test('protects routes and honors a local returnUrl after login', async ({ page }) => {
  await page.route('**/api/v1/auth/sessions/current', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'SESSION_INVALID', message: 'Sesión no válida.' }),
    });
  });
  await page.route('**/api/v1/auth/sessions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sessionResponse()),
    });
  });

  await page.goto('./ventas');
  await expect(page).toHaveURL((url) => {
    return (
      url.pathname.endsWith('/v2/login') && url.searchParams.get('returnUrl') === '/ventas/pos'
    );
  });
  await completeLogin(page);
  await expect(page).toHaveURL((url) => url.pathname.endsWith('/v2/ventas/pos'));
  await expect(page.getByRole('heading', { name: 'Buscar o escanear' })).toBeVisible();
});

test('renews before expiration and logs out through the server', async ({ page }) => {
  let refreshCount = 0;
  let logoutCount = 0;
  await page.route('**/api/v1/auth/sessions/current', async (route) => {
    if (route.request().method() === 'DELETE') {
      logoutCount += 1;
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sessionResponse(new Date(Date.now() + 1_500).toISOString())),
    });
  });
  await page.route('**/api/v1/auth/sessions/refresh', async (route) => {
    refreshCount += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sessionResponse()),
    });
  });

  await page.goto('./dashboard');
  await expect(page).toHaveURL((url) => url.pathname.endsWith('/v2/dashboard/resumen'));
  await expect.poll(() => refreshCount, { timeout: 5_000 }).toBe(1);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();

  await expect.poll(() => logoutCount).toBe(1);
  await expect(page).toHaveURL(/\/v2\/login$/);
});
