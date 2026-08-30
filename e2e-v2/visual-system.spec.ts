import { expect, test } from '@playwright/test';

test('offers contextual Ribbon commands with keyboard navigation', async ({ page }) => {
  await page.goto('./');

  await expect(page).toHaveTitle('UInventario Web V2');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Operación clara');
  await page.getByRole('button', { name: 'Nuevo' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Comando invocado' })).toContainText(
    'new-product',
  );

  const catalogTab = page.getByRole('tab', { name: 'Catálogo' });
  await catalogTab.focus();
  await catalogTab.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Inventario' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Entrada' })).toBeVisible();
});

test('covers operational states without page overflow', async ({ page }) => {
  await page.goto('./');

  await page.getByRole('button', { name: 'Offline' }).click();
  await expect(page.getByText('Sin conexión', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sin permisos' }).click();
  await expect(page.getByText('Permisos insuficientes', { exact: true })).toBeVisible();

  const hasPageOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasPageOverflow).toBe(false);
  await expect(page.getByRole('link', { name: 'Abrir versión estable' })).toHaveAttribute(
    'href',
    '/',
  );
});
