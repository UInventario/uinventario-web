import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

const branches = [
  {
    id: 'branch-1',
    name: 'Centro',
    timezone: 'America/Mexico_City',
    active: true,
    warehouses: [{ id: 'warehouse-1', name: 'Principal', active: true, locations: [] }],
    cashRegisters: [{ id: 'register-1', name: 'Caja Centro', code: 'CENTRO' }],
  },
  {
    id: 'branch-2',
    name: 'Norte',
    timezone: 'America/Mexico_City',
    active: true,
    warehouses: [{ id: 'warehouse-2', name: 'Bodega Norte', active: true, locations: [] }],
    cashRegisters: [{ id: 'register-2', name: 'Caja Norte', code: 'NORTE' }],
  },
];

function sessionResponse(
  permissions: readonly string[],
  context = {
    branch: { id: 'branch-1', name: 'Centro' },
    warehouse: { id: 'warehouse-1', name: 'Principal' },
    cashRegister: { id: 'register-1', name: 'Caja Centro', code: 'CENTRO' },
  },
) {
  return {
    data: {
      user: { id: 'user-1', email: 'operator@example.com', roles: [], permissions },
      tenant: { id: 'tenant-1', name: 'Comercializadora Uno' },
      context,
      nextStep: 'APPLICATION',
    },
    meta: {
      apiVersion: '1',
      sessionExpiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    },
  };
}

async function fulfillJson(route: Route, body: unknown): Promise<void> {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockSession(page: Page, permissions: readonly string[]): Promise<void> {
  await page.route('**/api/v1/auth/sessions/current', async (route) => {
    if (route.request().method() === 'PATCH') return;
    await fulfillJson(route, sessionResponse(permissions));
  });
  await page.route('**/api/v1/organization/branches', async (route) => {
    await fulfillJson(route, { data: branches, meta: { apiVersion: '1' } });
  });
}

test('changes branch, warehouse and register without reloading the workspace', async ({ page }) => {
  const permissions = ['INVENTORY_VIEW', 'SALES_MANAGE'];
  let contextBody: unknown;
  await mockSession(page, permissions);
  await page.route('**/api/v1/auth/sessions/current/context', async (route) => {
    contextBody = route.request().postDataJSON();
    await fulfillJson(
      route,
      sessionResponse(permissions, {
        branch: { id: 'branch-2', name: 'Norte' },
        warehouse: { id: 'warehouse-2', name: 'Bodega Norte' },
        cashRegister: { id: 'register-2', name: 'Caja Norte', code: 'NORTE' },
      }),
    );
  });

  await page.goto('./dashboard');
  await page.getByRole('button', { name: 'Cambiar contexto operativo' }).click();
  await page.getByLabel('Sucursal').selectOption({ label: 'Norte' });
  await expect(page.getByLabel('Bodega')).toHaveValue('warehouse-2');
  await expect(page.getByLabel('Caja')).toHaveValue('register-2');
  await page.getByRole('button', { name: 'Aplicar contexto' }).click();

  expect(contextBody).toEqual({
    branchId: 'branch-2',
    warehouseId: 'warehouse-2',
    cashRegisterId: 'register-2',
  });
  await expect(page.getByRole('button', { name: 'Cambiar contexto operativo' })).toContainText(
    'Norte',
  );
  await expect(page).toHaveURL((url) => url.pathname.endsWith('/v2/dashboard/resumen'));
});

test('enforces permissions on direct routes and operational commands', async ({ page }) => {
  await mockSession(page, ['INVENTORY_VIEW']);

  await page.goto('./ventas');
  await expect(page).toHaveURL(
    (url) =>
      url.pathname.endsWith('/v2/dashboard/resumen') &&
      url.searchParams.get('accessDenied') === 'true',
  );
  await expect(page.getByRole('alert')).toContainText('no tiene permiso');
  await expect(page.getByRole('link', { name: 'Ventas', exact: true })).toHaveCount(0);

  const navigationToggle = page.getByRole('button', { name: 'Alternar navegación' });
  if (await navigationToggle.isVisible()) await navigationToggle.click();
  await page.getByRole('link', { name: 'Inventario', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Entrada' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Ajuste' })).toBeDisabled();
});
