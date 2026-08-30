import { expect, test } from '@playwright/test';

test('boots the isolated Web V2 application', async ({ page }) => {
  await page.goto('./');

  await expect(page).toHaveTitle('UInventario Web V2');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Una nueva interfaz');
  await expect(page.getByRole('link', { name: 'Abrir versión estable' })).toHaveAttribute(
    'href',
    '/',
  );
});
