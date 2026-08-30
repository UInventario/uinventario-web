import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

const branch = {
  id: 'branch-1',
  name: 'Centro',
  timezone: 'America/Mexico_City',
  active: true,
  warehouses: [{ id: 'warehouse-1', name: 'Principal', active: true, locations: [] }],
  cashRegisters: [{ id: 'register-1', name: 'Caja 1', code: 'CAJA-01' }],
};

function customer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'customer-1',
    name: 'Ana Pérez',
    identifier: 'RFC-ANA-01',
    email: 'ana@example.com',
    phone: '+52 555 0101',
    dataProcessingConsent: true,
    privacyStatus: 'ACTIVE',
    anonymizedAt: null,
    privacyRetentionUntil: null,
    active: true,
    version: 2,
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-08-30T12:00:00.000Z',
    credit: {
      enabled: true,
      limit: '5000.00',
      currency: 'MXN',
      termDays: 30,
      maxInstallments: 3,
      balance: '800.00',
      available: '4200.00',
      overdueAmount: '0.00',
      status: 'AVAILABLE',
    },
    ...overrides,
  };
}

function session(permissions = ['SALES_MANAGE']) {
  return {
    data: {
      user: { id: 'user-1', email: 'admin@example.com', roles: ['ADMIN'], permissions },
      tenant: { id: 'tenant-1', name: 'Tienda Central' },
      context: {
        branch: { id: branch.id, name: branch.name },
        warehouse: { id: 'warehouse-1', name: 'Principal' },
        cashRegister: { id: 'register-1', name: 'Caja 1', code: 'CAJA-01' },
      },
      nextStep: 'APPLICATION',
    },
    meta: { apiVersion: '1', sessionExpiresAt: new Date(Date.now() + 3_600_000).toISOString() },
  };
}

function customerList(customers: unknown[]) {
  return {
    data: customers,
    meta: {
      apiVersion: '1',
      pagination: { page: 1, pageSize: 20, total: customers.length, totalPages: 1 },
    },
  };
}

function historyResponse(current = customer()) {
  return {
    data: {
      customer: current,
      credit: null,
      summary: {
        currency: 'MXN',
        salesCount: 1,
        completedCount: 1,
        voidedCount: 0,
        completedAmount: '299.00',
        voidedAmount: '0.00',
      },
      items: [
        {
          id: 'sale-1',
          receiptNumber: 'V-000001',
          status: 'COMPLETED',
          currency: 'MXN',
          total: '299.00',
          createdAt: '2026-08-30T15:00:00.000Z',
          cashRegister: { id: 'register-1', name: 'Caja 1', code: 'CAJA-01' },
          responsible: { id: 'user-1', email: 'admin@example.com' },
          payments: [],
          reversal: null,
        },
      ],
    },
    meta: {
      apiVersion: '1',
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    },
  };
}

function privacyReport(current = customer(), hold: unknown = null) {
  return {
    data: {
      subject: current,
      transactions: {
        count: 1,
        firstAt: '2026-08-30T15:00:00.000Z',
        lastAt: '2026-08-30T15:00:00.000Z',
        retainedUntil: '2031-08-30T15:00:00.000Z',
        disposition: 'PRESERVED_WITHOUT_CASCADE_DELETE',
      },
      policy: {
        countryCode: 'MX',
        minimumTransactionRetentionDays: 1825,
        transactionRetentionDays: 1825,
        policyCode: 'MX-COMMERCE-5Y',
        version: 1,
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
      activeLegalHold: hold,
      recentDecisions: [],
      propagation: { primaryDatabase: 'IMMEDIATE' },
    },
    meta: { apiVersion: '1' },
  };
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockBase(
  page: Page,
  handler: (route: Route, path: string, url: URL) => Promise<boolean>,
  permissions?: string[],
): Promise<void> {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');
    if (await handler(route, path, url)) return;
    if (path === '/auth/sessions/current') return json(route, session(permissions));
    if (path === '/organization/branches')
      return json(route, { data: [branch], meta: { apiVersion: '1' } });
    throw new Error(`Request no simulada: ${route.request().method()} ${path}`);
  });
}

test('searches, creates, revokes consent and safely deactivates customers', async ({ page }) => {
  let customers = [customer()];
  const writes: Array<{ method: string; body: Record<string, unknown> | null }> = [];
  let lastQuery = '';
  await mockBase(page, async (route, path, url) => {
    const method = route.request().method();
    if (path === '/customers' && method === 'GET') {
      lastQuery = url.search;
      await json(route, customerList(customers));
      return true;
    }
    if (path === '/customers' && method === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      writes.push({ method, body });
      const created = customer({ id: 'customer-2', version: 1, ...body });
      customers = [...customers, created];
      await json(route, { data: created, meta: { apiVersion: '1' } });
      return true;
    }
    if (path === '/customers/customer-1' && method === 'PATCH') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      writes.push({ method, body });
      customers = [
        customer({ email: null, phone: null, dataProcessingConsent: false, version: 3 }),
        customers[1],
      ].filter(Boolean);
      await json(route, { data: customers[0], meta: { apiVersion: '1' } });
      return true;
    }
    if (path === '/customers/customer-2' && method === 'DELETE') {
      writes.push({ method, body: null });
      customers = customers.map((item) =>
        (item as { id: string }).id === 'customer-2'
          ? { ...(item as object), active: false }
          : item,
      );
      await json(route, { data: customers[1], meta: { apiVersion: '1' } });
      return true;
    }
    return false;
  });

  await page.goto('./ventas');
  await expect(page).toHaveURL(/\/ventas\/clientes/);
  await page.getByLabel('Buscar clientes').fill('Ana');
  await page.getByRole('button', { name: 'Aplicar' }).click();
  await expect(page).toHaveURL(/q=Ana/);
  expect(lastQuery).toContain('q=Ana');

  await page.getByRole('button', { name: 'Nuevo cliente' }).click();
  const createDialog = page.getByRole('dialog', { name: 'Nuevo cliente' });
  await createDialog.getByLabel('Nombre').fill('Luis Soto');
  await createDialog.getByLabel('Correo', { exact: true }).fill('luis@example.com');
  await createDialog.getByLabel('Consentimiento para datos de contacto').check();
  await createDialog.getByRole('button', { name: 'Guardar cliente' }).click();
  await expect(page.getByText('Cliente creado.')).toBeVisible();

  await page.getByRole('button', { name: 'Editar Ana Pérez' }).click();
  const editDialog = page.getByRole('dialog', { name: 'Ana Pérez' });
  await editDialog.getByLabel('Consentimiento para datos de contacto').uncheck();
  await expect(editDialog.getByText('se eliminarán el correo y el teléfono')).toBeVisible();
  await editDialog.getByRole('button', { name: 'Guardar cliente' }).click();
  expect(writes[1].body).toMatchObject({ dataProcessingConsent: false, version: 2 });
  expect(writes[1].body).not.toHaveProperty('email');
  expect(writes[1].body).not.toHaveProperty('phone');

  await page.getByRole('button', { name: 'Desactivar Luis Soto' }).click();
  await page.getByLabel(/Escribe.*Luis Soto/).fill('Luis Soto');
  await page.getByRole('button', { name: 'Desactivar', exact: true }).click();
  await expect(page.getByText('Cliente desactivado; su historial se conserva.')).toBeVisible();
  expect(writes.map(({ method }) => method)).toEqual(['POST', 'PATCH', 'DELETE']);
});

test('hides credit without permission and exposes customer history', async ({ page }) => {
  await mockBase(
    page,
    async (route, path) => {
      if (path === '/customers') {
        await json(route, customerList([customer()]));
        return true;
      }
      if (path === '/customers/customer-1/history') {
        await json(route, historyResponse());
        return true;
      }
      return false;
    },
    ['SALES_MANAGE'],
  );

  await page.goto('./ventas/clientes');
  await expect(page.getByRole('button', { name: 'Configurar crédito de Ana Pérez' })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Ver Ana Pérez' }).click();
  await expect(page.getByText('V-000001')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Crédito', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Privacidad', exact: true })).toHaveCount(0);
});

test('configures credit and shows balances only with credit permission', async ({ page }) => {
  let configured = customer();
  let creditWrite: Record<string, unknown> | null = null;
  await mockBase(
    page,
    async (route, path) => {
      const method = route.request().method();
      if (path === '/customers') {
        await json(route, customerList([configured]));
        return true;
      }
      if (path === '/customers/customer-1/credit' && method === 'PATCH') {
        creditWrite = route.request().postDataJSON() as Record<string, unknown>;
        configured = customer({ version: 3, credit: { ...customer().credit, limit: '7000.00' } });
        await json(route, { data: configured, meta: { apiVersion: '1' } });
        return true;
      }
      if (path === '/customers/customer-1/history') {
        await json(route, historyResponse(configured));
        return true;
      }
      if (path === '/customers/customer-1/credit' && method === 'GET') {
        await json(route, {
          data: {
            currency: 'MXN',
            balance: '800.00',
            overdueAmount: '0.00',
            status: 'AVAILABLE',
            accounts: [],
            payments: [],
          },
          meta: { apiVersion: '1' },
        });
        return true;
      }
      return false;
    },
    ['SALES_MANAGE', 'SALES_CREDIT'],
  );

  await page.goto('./ventas/clientes');
  await expect(page.getByText('800.00 MXN')).toBeVisible();
  await page.getByRole('button', { name: 'Configurar crédito de Ana Pérez' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ana Pérez' });
  await dialog.getByLabel('Límite', { exact: true }).fill('7000');
  await dialog.getByRole('button', { name: 'Guardar crédito' }).click();
  expect(creditWrite).toMatchObject({ creditLimit: '7000', version: 2 });

  await page.getByRole('button', { name: 'Ver Ana Pérez' }).click();
  await page.getByRole('button', { name: 'Crédito', exact: true }).click();
  await expect(page.getByText('Saldo')).toBeVisible();
  await expect(
    page.getByRole('dialog', { name: 'Ana Pérez' }).getByText('800.00 MXN'),
  ).toBeVisible();
});

test('updates retention and completes export, legal hold and anonymization flows', async ({
  page,
}) => {
  let current = customer();
  let hold: Record<string, unknown> | null = null;
  const privacyWrites: Array<{ path: string; body: Record<string, unknown>; key: string | null }> =
    [];
  let exports = 0;
  await mockBase(
    page,
    async (route, path) => {
      const method = route.request().method();
      if (path === '/customers') {
        await json(route, customerList([current]));
        return true;
      }
      if (path === '/customers/customer-1/history') {
        await json(route, historyResponse(current));
        return true;
      }
      if (path === '/privacy/policy' && method === 'GET') {
        await json(
          route,
          privacyReport().data.policy
            ? { data: privacyReport().data.policy, meta: { apiVersion: '1' } }
            : {},
        );
        return true;
      }
      if (path === '/privacy/policy' && method === 'PATCH') {
        privacyWrites.push({
          path,
          body: route.request().postDataJSON(),
          key: route.request().headers()['idempotency-key'] ?? null,
        });
        await json(route, {
          data: { ...privacyReport().data.policy, transactionRetentionDays: 2000, version: 2 },
          meta: { apiVersion: '1' },
        });
        return true;
      }
      if (path === '/privacy/customers/customer-1/report') {
        await json(route, privacyReport(current, hold));
        return true;
      }
      if (path === '/privacy/customers/customer-1/export') {
        exports += 1;
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(privacyReport(current, hold)),
        });
        return true;
      }
      if (path === '/privacy/customers/customer-1/legal-holds' && method === 'POST') {
        privacyWrites.push({
          path,
          body: route.request().postDataJSON(),
          key: route.request().headers()['idempotency-key'] ?? null,
        });
        hold = {
          id: 'hold-1',
          active: true,
          reason: 'Investigación legal',
          expiresAt: null,
          createdAt: '2026-08-30T15:00:00.000Z',
        };
        await json(route, { data: hold, meta: { apiVersion: '1' } });
        return true;
      }
      if (path.endsWith('/legal-holds/release') && method === 'POST') {
        privacyWrites.push({
          path,
          body: route.request().postDataJSON(),
          key: route.request().headers()['idempotency-key'] ?? null,
        });
        hold = null;
        await json(route, { data: { released: true }, meta: { apiVersion: '1' } });
        return true;
      }
      if (path.endsWith('/anonymization') && method === 'POST') {
        privacyWrites.push({
          path,
          body: route.request().postDataJSON(),
          key: route.request().headers()['idempotency-key'] ?? null,
        });
        current = customer({
          name: 'Cliente anonimizado customer',
          privacyStatus: 'ANONYMIZED',
          active: false,
          email: null,
          phone: null,
        });
        await json(route, { data: { anonymized: true }, meta: { apiVersion: '1' } });
        return true;
      }
      return false;
    },
    ['SALES_MANAGE', 'PRIVACY_MANAGE'],
  );

  await page.goto('./ventas/clientes');
  await page.getByRole('button', { name: 'Retención y privacidad' }).click();
  await page.getByLabel('Días de retención').fill('2000');
  await page.getByLabel('Razón del cambio').fill('Actualización normativa');
  await page.getByLabel('Referencia').fill('LEGAL-2026');
  await page.getByRole('button', { name: 'Actualizar política' }).click();
  await expect(page.getByText('Política de retención actualizada y auditada.')).toBeVisible();

  await page.getByRole('button', { name: 'Clientes', exact: true }).click();
  await page.getByRole('button', { name: 'Ver Ana Pérez' }).click();
  await page.getByRole('button', { name: 'Privacidad', exact: true }).click();
  await expect(page.getByText('Retención hasta')).toBeVisible();
  await page.getByRole('button', { name: 'Exportar datos' }).click();
  await expect(page.getByText('Exportación generada y registrada en auditoría.')).toBeVisible();
  expect(exports).toBe(1);

  await page.getByRole('button', { name: 'Aplicar bloqueo legal' }).click();
  await page.getByLabel('Razón').fill('Investigación legal');
  await page.getByLabel('Referencia').fill('CASE-42');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByText('Bloqueo legal aplicado.')).toBeVisible();
  await page.getByRole('button', { name: 'Liberar bloqueo' }).click();
  await page.getByLabel('Razón').fill('Investigación cerrada');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByText('Bloqueo legal liberado.')).toBeVisible();

  await page.getByRole('button', { name: 'Anonimizar' }).click();
  await page.getByLabel('Razón').fill('Solicitud del titular');
  await page.getByLabel('Escribe Ana Pérez para confirmar').fill('Ana Pérez');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByText('Cliente anonimizado customer')).toBeVisible();
  expect(privacyWrites).toHaveLength(4);
  expect(privacyWrites.every(({ key }) => key?.startsWith('web-'))).toBe(true);
});

test('requires customer management permission on the direct route', async ({ page }) => {
  await mockBase(page, async () => false, ['SALES_VOID']);

  await page.goto('./ventas/clientes');

  await expect(page).toHaveURL(/\/v2\/dashboard\?accessDenied=true$/);
  await expect(page.getByRole('alert')).toContainText('no tiene permiso');
});
