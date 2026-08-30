import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

const branch = {
  id: 'branch-1',
  name: 'Centro',
  timezone: 'America/Mexico_City',
  active: true,
  warehouses: [],
  cashRegisters: [
    { id: 'register-1', name: 'Caja principal', code: 'CAJA-1', branchId: 'branch-1' },
  ],
};

const initialRole = {
  id: 'role-1',
  name: 'Cajero',
  permissions: ['SALES_MANAGE', 'CASH_REGISTER_OPEN'],
};

function session() {
  return {
    data: {
      user: {
        id: 'admin-1',
        email: 'admin@example.com',
        roles: ['ADMIN'],
        permissions: ['ACCESS_MANAGE', 'TENANT_MANAGE'],
      },
      tenant: { id: 'tenant-1', name: 'Tienda Central' },
      context: {
        branch: { id: branch.id, name: branch.name },
        warehouse: null,
        cashRegister: { id: 'register-1', name: 'Caja principal', code: 'CAJA-1' },
      },
      nextStep: 'APPLICATION',
    },
    meta: {
      apiVersion: '1',
      sessionExpiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    },
  };
}

async function json(route: Route, data: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
}

async function mockAccess(page: Page) {
  let roles = [initialRole];
  let users = [
    {
      id: 'admin-1',
      email: 'admin@example.com',
      active: true,
      roles: [{ id: 'admin-role', name: 'Administrador', permissions: [] }],
      branches: [{ id: branch.id, name: branch.name }],
      cashRegisters: [],
      manageable: false,
    },
  ];
  const writes: Array<{ path: string; method: string; body: unknown }> = [];

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1', '');
    const method = request.method();
    if (path === '/auth/sessions/current') return json(route, session());
    if (path === '/organization/branches') {
      return json(route, { data: [branch], meta: { apiVersion: '1' } });
    }
    if (path === '/access/roles' && method === 'GET') {
      return json(route, { data: roles, meta: { apiVersion: '1' } });
    }
    if (path === '/access/roles' && method === 'POST') {
      const body = request.postDataJSON();
      const created = { id: 'role-2', ...body };
      roles = [...roles, created];
      writes.push({ path, method, body });
      return json(route, { data: created, meta: { apiVersion: '1' } }, 201);
    }
    if (path === '/access/users' && method === 'GET') {
      return json(route, { data: users, meta: { apiVersion: '1' } });
    }
    if (path === '/access/users' && method === 'POST') {
      const body = request.postDataJSON();
      const created = {
        id: 'user-2',
        email: body.email,
        active: true,
        roles: roles.filter((role) => body.roleIds.includes(role.id)),
        branches: [{ id: branch.id, name: branch.name }],
        cashRegisters: branch.cashRegisters.filter((register) =>
          body.cashRegisterIds.includes(register.id),
        ),
        manageable: true,
      };
      users = [...users, created];
      writes.push({ path, method, body });
      return json(route, { data: created, meta: { apiVersion: '1' } }, 201);
    }
    if (path === '/access/users/user-2' && method === 'PATCH') {
      const body = request.postDataJSON();
      writes.push({ path, method, body });
      return json(route, { data: users[1], meta: { apiVersion: '1' } });
    }
    if (path === '/access/users/user-2/retirement' && method === 'POST') {
      const body = request.postDataJSON();
      users = users.map((user) =>
        user.id === 'user-2'
          ? { ...user, active: false, roles: [], branches: [], cashRegisters: [] }
          : user,
      );
      writes.push({ path, method, body });
      return json(route, { data: users[1], meta: { apiVersion: '1' } });
    }
    return json(route, { message: `Unhandled ${method} ${path}` }, 404);
  });

  return writes;
}

test('creates a role and manages one user through scoped access', async ({ page }, testInfo) => {
  const writes = await mockAccess(page);
  await page.goto('./administracion/accesos');

  await expect(page.getByRole('heading', { name: 'Usuarios y accesos' })).toBeVisible();
  await expect(page.getByText('admin@example.com')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('access-users.png') });

  await page.getByRole('button', { name: 'Nuevo rol' }).click();
  await page.getByLabel('Nombre del rol').fill('Catalogador');
  await page
    .locator('.check-card')
    .filter({ hasText: 'Gestionar productos' })
    .locator('input')
    .check();
  await page.getByRole('button', { name: 'Crear rol' }).click();
  await expect(page.locator('.notice.success')).toContainText('Se creó el rol Catalogador');

  await page.getByRole('button', { name: 'Nuevo usuario' }).click();
  await page.getByLabel('Correo').fill('operator@example.com');
  await page.getByLabel('Contraseña temporal').fill('Secure-password1!');
  await page.locator('.selection-card').filter({ hasText: 'Catalogador' }).locator('input').check();
  await page.locator('.selection-card').filter({ hasText: 'Centro' }).locator('input').check();
  await page
    .locator('.selection-card')
    .filter({ hasText: 'Caja principal' })
    .locator('input')
    .check();
  await page.getByRole('button', { name: 'Crear usuario' }).click();
  await expect(
    page.locator('ui-access-user-table').getByText('operator@example.com', { exact: true }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Editar operator@example.com' }).click();
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.locator('.notice.success')).toContainText('Se actualizó el acceso');

  await page.getByRole('button', { name: 'Retirar operator@example.com' }).click();
  const retirement = page.getByRole('alertdialog');
  const retireButton = retirement.getByRole('button', { name: 'Retirar acceso' });
  await retirement.getByLabel('Escribe el correo para confirmar').fill('incorrecto@example.com');
  await expect(retireButton).toBeDisabled();
  await retirement.getByLabel('Escribe el correo para confirmar').fill('operator@example.com');
  await page.screenshot({ path: testInfo.outputPath('access-retirement.png') });
  await retireButton.click();
  await expect(
    page.locator('ui-access-user-table').getByText('operator@example.com', { exact: true }),
  ).toHaveCount(0);
  await page.locator('.toolbar select').selectOption('RETIRED');
  await expect(
    page.locator('ui-access-user-table').getByText('operator@example.com', { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('ui-access-user-table').getByText('Retirado', { exact: true }),
  ).toBeVisible();

  await page.getByRole('tab', { name: 'Matriz de roles' }).click();
  await expect(page.getByRole('table')).toContainText('Gestionar productos');
  await expect(page.getByRole('table')).toContainText('Catalogador');
  await page.screenshot({ path: testInfo.outputPath('access-matrix.png') });

  expect(writes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ path: '/access/roles', method: 'POST' }),
      expect.objectContaining({ path: '/access/users', method: 'POST' }),
      expect.objectContaining({ path: '/access/users/user-2', method: 'PATCH' }),
      expect.objectContaining({
        path: '/access/users/user-2/retirement',
        body: { confirmationEmail: 'operator@example.com' },
      }),
    ]),
  );
});

test('keeps the access workspace usable on a mobile viewport', async ({ page }, testInfo) => {
  await mockAccess(page);
  await page.goto('./administracion/accesos');
  await expect(page.getByRole('heading', { name: 'Usuarios y accesos' })).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    headingTop: document.querySelector('#access-title')?.getBoundingClientRect().top,
  }));
  expect(dimensions.documentWidth).toBe(dimensions.viewportWidth);
  expect(dimensions.headingTop).toBeGreaterThanOrEqual(0);

  await page.getByRole('button', { name: 'Nuevo usuario' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box?.width).toBeLessThanOrEqual(dimensions.viewportWidth);
  await page.screenshot({ path: testInfo.outputPath('access-mobile-dialog.png') });
});
