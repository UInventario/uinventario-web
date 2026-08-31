import { expect, test } from '@playwright/test';

const workspaces = [
  { path: 'dashboard', workspace: 'Dashboard', heading: 'Dashboard', posMode: false },
  { path: 'catalogo', workspace: 'Catálogo', heading: 'Catálogo', posMode: false },
  { path: 'inventario', workspace: 'Inventario', heading: 'Inventario', posMode: false },
  {
    path: 'compras/proveedores',
    workspace: 'Compras',
    heading: 'Proveedores',
    posMode: false,
  },
  { path: 'ventas/pos', workspace: 'Ventas', heading: 'Venta rápida', posMode: true },
  { path: 'reportes', workspace: 'Reportes', heading: 'Reportes', posMode: false },
  {
    path: 'administracion',
    workspace: 'Administración',
    heading: 'Administración',
    posMode: false,
  },
] as const;

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/auth/sessions/current', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          user: {
            id: 'user-1',
            email: 'admin@example.com',
            roles: ['ADMIN'],
            permissions: [
              'PRODUCTS_MANAGE',
              'INVENTORY_VIEW',
              'SUPPLIERS_MANAGE',
              'PURCHASE_ORDERS_MANAGE',
              'SALES_MANAGE',
              'AUDIT_VIEW',
              'TENANT_MANAGE',
            ],
          },
          tenant: { id: 'tenant-1', name: 'Tienda Central' },
          context: {
            branch: { id: 'branch-1', name: 'Principal' },
            warehouse: { id: 'warehouse-1', name: 'Bodega' },
            cashRegister: { id: 'register-1', name: 'Caja', code: 'CAJA-1' },
          },
          nextStep: 'APPLICATION',
        },
        meta: {
          apiVersion: '1',
          sessionExpiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
        },
      }),
    });
  });
  await page.route('**/api/v1/organization/branches', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'branch-1',
            name: 'Principal',
            timezone: 'America/Mexico_City',
            active: true,
            warehouses: [{ id: 'warehouse-1', name: 'Bodega', active: true, locations: [] }],
            cashRegisters: [{ id: 'register-1', name: 'Caja', code: 'CAJA-1' }],
          },
        ],
        meta: { apiVersion: '1' },
      }),
    });
  });
});

test('navigates independent workspaces without hashes or a giant document', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveURL(/\/v2\/dashboard\/resumen\?/);

  for (const { path, workspace, heading, posMode } of workspaces) {
    if (path !== 'dashboard') {
      const toggle = page.getByRole('button', { name: 'Alternar navegación' });
      if (await toggle.isVisible()) await toggle.click();
      await page.getByRole('link', { name: workspace, exact: true }).click();
    }

    await expect(page).toHaveURL(
      path === 'dashboard' ? /\/v2\/dashboard\/resumen\?/ : new RegExp(`/v2/${path}$`),
    );
    const content = posMode
      ? page.getByRole('region', { name: heading })
      : page.getByRole('heading', { level: 1, name: heading });
    await expect(content).toBeVisible();
    if (!posMode) {
      await expect(page.getByLabel('Breadcrumb')).toContainText(workspace);
      await expect(page.getByRole('tab', { name: workspace })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    }
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
  await expect(page.getByRole('heading', { level: 1, name: 'Proveedores' })).toBeVisible();

  const deferredScripts = [...loadedScripts].filter((script) => !initialScripts.has(script));
  expect(deferredScripts.length).toBeGreaterThan(0);
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toHaveCount(0);
});
