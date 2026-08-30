import { expect, test } from '@playwright/test';

const workspaces = [
  ['dashboard', 'Dashboard'],
  ['catalogo', 'Catálogo'],
  ['inventario', 'Inventario'],
  ['compras', 'Compras'],
  ['ventas', 'Ventas'],
  ['reportes', 'Reportes'],
  ['administracion', 'Administración'],
] as const;

test('navigates independent workspaces without hashes or a giant document', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveURL(/\/v2\/dashboard$/);

  for (const [path, label] of workspaces) {
    if (path !== 'dashboard') {
      const toggle = page.getByRole('button', { name: 'Alternar navegación' });
      if (await toggle.isVisible()) await toggle.click();
      await page.getByRole('link', { name: label, exact: true }).click();
    }

    await expect(page).toHaveURL(new RegExp(`/v2/${path}$`));
    await expect(page.getByRole('heading', { level: 1, name: label })).toBeVisible();
    await expect(page.getByLabel('Breadcrumb')).toContainText(label);
    await expect(page.getByRole('tab', { name: label })).toHaveAttribute('aria-selected', 'true');
    expect(page.url()).not.toContain('#');
  }

  const dimensions = await page.evaluate(() => ({
    documentScrollsX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    shellHeight: document.querySelector('.app-shell')?.getBoundingClientRect().height,
    viewportHeight: window.innerHeight,
  }));
  expect(dimensions.documentScrollsX).toBe(false);
  expect(dimensions.shellHeight).toBe(dimensions.viewportHeight);
});

test('loads an unvisited workspace only when the user opens it', async ({ page }) => {
  const loadedScripts = new Set<string>();
  page.on('response', (response) => {
    if (response.url().endsWith('.js')) loadedScripts.add(response.url());
  });

  await page.goto('./dashboard');
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  const initialScripts = new Set(loadedScripts);

  const toggle = page.getByRole('button', { name: 'Alternar navegación' });
  if (await toggle.isVisible()) await toggle.click();
  await page.getByRole('link', { name: 'Compras', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Compras' })).toBeVisible();

  const deferredScripts = [...loadedScripts].filter((script) => !initialScripts.has(script));
  expect(deferredScripts.length).toBeGreaterThan(0);
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toHaveCount(0);
});
