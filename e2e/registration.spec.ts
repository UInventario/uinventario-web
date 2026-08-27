import { expect, test } from '@playwright/test';

const password = 'Correcta-2026!';

async function fillRegistration(page: import('@playwright/test').Page, email: string) {
  await page.getByLabel('Nombre de la organización').fill('Tienda QA');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByLabel('Confirma la contraseña').fill(password);
}

async function expectViewportFit(page: import('@playwright/test').Page) {
  const fit = await page.evaluate(() => {
    const card = document.querySelector('.auth-card')?.getBoundingClientRect();
    return {
      horizontalOverflow:
        document.documentElement.scrollWidth > document.documentElement.clientWidth,
      cardWithinViewport: !!card && card.left >= 0 && card.right <= window.innerWidth,
    };
  });
  expect(fit).toEqual({
    horizontalOverflow: false,
    cardWithinViewport: true,
  });
}

test('registers through the real UI and reaches login', async ({ page }, testInfo) => {
  const email = `qa-${testInfo.project.name}-${Date.now()}@example.com`;
  await page.goto('/registro');

  await expect(page.getByRole('heading', { name: 'Crea tu cuenta' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Crear cuenta' })).toBeVisible();
  await expectViewportFit(page);
  await page.screenshot({ path: testInfo.outputPath('registration-initial.png'), fullPage: true });

  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByText('Escribe un nombre de al menos 2 caracteres.')).toBeVisible();

  await fillRegistration(page, email);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Tu cuenta y organización se crearon correctamente.')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('registration-success.png'), fullPage: true });

  await page.getByRole('link', { name: 'Crear otra cuenta' }).click();
  await expect(page).toHaveURL(/\/registro$/);
});

test('shows a generic error for an existing account', async ({ page }, testInfo) => {
  const email = `qa-duplicate-${testInfo.project.name}-${Date.now()}@example.com`;
  await page.goto('/registro');
  await fillRegistration(page, email);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto('/registro');
  await fillRegistration(page, email);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  await expect(page.getByText('No fue posible crear la cuenta con esos datos.')).toBeVisible();
  await expect(page).toHaveURL(/\/registro$/);
  await page.screenshot({ path: testInfo.outputPath('registration-conflict.png'), fullPage: true });
});
