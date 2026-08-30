import { expect, test } from '@playwright/test';
import type { Route } from '@playwright/test';

const initialBranch = {
  id: 'branch-1',
  name: 'Sucursal principal',
  timezone: 'America/Mexico_City',
  active: true,
  warehouses: [
    {
      id: 'warehouse-1',
      name: 'Bodega principal',
      active: true,
      locations: [{ id: 'location-1', name: 'Ubicación general', code: 'GENERAL', active: true }],
    },
  ],
  cashRegisters: [{ id: 'register-1', name: 'Caja principal', code: 'CAJA-001' }],
};

function sessionResponse(nextStep: 'ONBOARDING' | 'APPLICATION') {
  return {
    data: {
      user: {
        id: 'user-1',
        email: 'admin@example.com',
        roles: ['ADMIN'],
        permissions: ['TENANT_MANAGE'],
      },
      tenant: { id: 'tenant-1', name: 'Tienda Central' },
      context:
        nextStep === 'APPLICATION'
          ? {
              branch: { id: 'branch-1', name: 'Sucursal principal' },
              warehouse: { id: 'warehouse-1', name: 'Bodega principal' },
              cashRegister: { id: 'register-1', name: 'Caja principal', code: 'CAJA-001' },
            }
          : { branch: null, warehouse: null, cashRegister: null },
      nextStep,
    },
    meta: {
      apiVersion: '1',
      sessionExpiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    },
  };
}

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

test('completes the guided company, location and cash register onboarding', async ({ page }) => {
  const requests: Record<string, unknown> = {};
  await page.route('**/api/v1/auth/sessions/current', (route) =>
    fulfillJson(route, sessionResponse('ONBOARDING')),
  );
  await page.route('**/api/v1/auth/sessions/refresh', (route) =>
    fulfillJson(route, sessionResponse('APPLICATION')),
  );
  await page.route('**/api/v1/onboarding/company', async (route) => {
    if (route.request().method() === 'PUT') {
      requests.company = route.request().postDataJSON();
      await fulfillJson(route, {
        data: {
          company: {
            legalName: 'Comercializadora Central',
            tradeName: 'Tienda Central',
            countryCode: 'MX',
          },
          progress: { currentStep: 'BRANCH', completedSteps: ['COMPANY'] },
        },
        meta: { apiVersion: '1' },
      });
      return;
    }
    await fulfillJson(route, {
      data: {
        company: { legalName: null, tradeName: 'Tienda Central', countryCode: null },
        progress: { currentStep: 'COMPANY', completedSteps: [] },
      },
      meta: { apiVersion: '1' },
    });
  });
  await page.route('**/api/v1/onboarding/initial-location', async (route) => {
    requests.location = route.request().postDataJSON();
    await fulfillJson(route, {
      data: {
        branch: { id: 'branch-1', name: 'Sucursal principal', timezone: 'America/Mexico_City' },
        warehouse: { id: 'warehouse-1', name: 'Bodega principal' },
        location: { id: 'location-1', name: 'Ubicación general', code: 'GENERAL' },
        progress: { currentStep: 'REGISTER', completedSteps: ['COMPANY', 'BRANCH'] },
      },
      meta: { apiVersion: '1' },
    });
  });
  await page.route('**/api/v1/onboarding/initial-cash-register', async (route) => {
    requests.register = route.request().postDataJSON();
    await fulfillJson(route, {
      data: {
        cashRegister: { id: 'register-1', name: 'Caja principal', code: 'CAJA-001' },
        branch: { id: 'branch-1', name: 'Sucursal principal' },
        progress: { currentStep: 'COMPLETE', completedSteps: ['COMPANY', 'BRANCH', 'REGISTER'] },
      },
      meta: { apiVersion: '1' },
    });
  });
  await page.route('**/api/v1/organization/branches', (route) =>
    fulfillJson(route, { data: [initialBranch], meta: { apiVersion: '1' } }),
  );

  await page.goto('./dashboard');
  await expect(page).toHaveURL(/\/v2\/onboarding$/);
  await page.getByLabel('Razón social').fill('Comercializadora Central');
  await page.getByLabel('Nombre comercial').fill('Tienda Central');
  await page.getByLabel('País').selectOption('MX');
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();

  await expect(page.getByRole('heading', { name: 'Crea tu operación inicial' })).toBeVisible();
  await page.getByLabel('Zona horaria').selectOption('America/Mexico_City');
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();

  await expect(page.getByRole('heading', { name: 'Agrega tu primera caja' })).toBeVisible();
  await page.getByRole('button', { name: 'Finalizar configuración' }).click();
  await expect(page).toHaveURL(/\/v2\/dashboard$/);

  expect(requests.company).toEqual({
    legalName: 'Comercializadora Central',
    tradeName: 'Tienda Central',
    countryCode: 'MX',
  });
  expect(requests.location).toMatchObject({
    branchName: 'Sucursal principal',
    timezone: 'America/Mexico_City',
    warehouseName: 'Bodega principal',
    locationName: 'Ubicación general',
  });
  expect(requests.register).toEqual({ name: 'Caja principal' });
});

test('creates and safely retires organization resources', async ({ page }) => {
  const calls: Array<{ method: string; body: unknown }> = [];
  let branches = [initialBranch];
  await page.route('**/api/v1/auth/sessions/current', (route) =>
    fulfillJson(route, sessionResponse('APPLICATION')),
  );
  await page.route('**/api/v1/organization/branches', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      calls.push({ method: 'POST_BRANCH', body });
      branches = [
        ...branches,
        {
          id: 'branch-2',
          name: body.name,
          timezone: body.timezone,
          active: true,
          warehouses: [
            {
              id: 'warehouse-2',
              name: body.warehouseName,
              active: true,
              locations: [
                {
                  id: 'location-2',
                  name: body.locationName,
                  code: body.locationCode,
                  active: true,
                },
              ],
            },
          ],
          cashRegisters: [],
        },
      ];
      await fulfillJson(route, { data: branches[1], meta: { apiVersion: '1' } }, 201);
      return;
    }
    await fulfillJson(route, { data: branches, meta: { apiVersion: '1' } });
  });
  await page.route('**/api/v1/organization/branches/branch-2', async (route) => {
    calls.push({ method: 'DELETE_BRANCH', body: null });
    branches = [initialBranch];
    await fulfillJson(route, {
      data: { id: 'branch-2', active: false },
      meta: { apiVersion: '1' },
    });
  });

  await page.goto('./administracion');
  await page.getByRole('button', { name: 'Nueva sucursal' }).click();
  await page.getByLabel('Nombre').fill('Sucursal Norte');
  await page.getByLabel('Bodega inicial').fill('Bodega Norte');
  await page.getByLabel('Ubicación inicial').fill('Piso 1');
  await page.getByLabel('Código de ubicación').fill('norte_general');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Sucursal Norte' })).toBeVisible();
  await expect(page.getByText('Bodega Norte')).toBeVisible();
  expect(calls[0]).toMatchObject({
    method: 'POST_BRANCH',
    body: { name: 'Sucursal Norte', locationCode: 'NORTE_GENERAL' },
  });

  await page.getByRole('button', { name: 'Retirar Sucursal Norte' }).click();
  await expect(page.getByRole('button', { name: 'Retirar', exact: true })).toBeDisabled();
  await page.getByLabel(/Escribe Sucursal Norte/).fill('Sucursal Norte');
  await page.getByRole('button', { name: 'Retirar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sucursal Norte' })).toHaveCount(0);
  expect(calls.at(-1)?.method).toBe('DELETE_BRANCH');
});
