import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { expectAccessible, expectViewportFit } from './accessibility.helpers';

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockIntegrations(page: Page): Promise<string[]> {
  const writes: string[] = [];
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1', '');
    if (path === '/auth/sessions/current') {
      return json(route, {
        data: {
          user: {
            id: 'admin-1',
            email: 'admin@example.com',
            roles: ['ADMIN'],
            permissions: ['TENANT_MANAGE'],
          },
          tenant: { id: 'tenant-1', name: 'Tienda Central' },
          context: {
            branch: { id: 'branch-1', name: 'Centro' },
            warehouse: null,
            cashRegister: null,
          },
          nextStep: 'APPLICATION',
        },
        meta: { apiVersion: '1', sessionExpiresAt: '2026-09-01T00:00:00.000Z' },
      });
    }
    if (path === '/organization/branches') {
      return json(route, { data: [], meta: { apiVersion: '1' } });
    }
    if (path === '/integrations/adapters' && request.method() === 'GET') {
      return json(route, {
        data: [
          {
            id: 'adapter-1',
            capability: 'NOTIFICATION_EMAIL',
            countryCode: 'MX',
            provider: 'SIMULATOR',
            adapterVersion: '1',
            enabled: false,
            timeoutMs: 5000,
            maxAttempts: 3,
            secretReference: 'projects/dev/secrets/provider-private-key',
            updatedAt: '2026-08-30T10:00:00.000Z',
          },
        ],
        meta: {
          catalog: [
            {
              capability: 'NOTIFICATION_EMAIL',
              provider: 'SIMULATOR',
              version: '1',
              mode: 'SIMULATOR',
            },
          ],
          secrets: { storage: 'SECRET_MANAGER', valuesAcceptedByApi: false },
        },
      });
    }
    if (path === '/integrations/adapters/NOTIFICATION_EMAIL' && request.method() === 'PUT') {
      writes.push(path);
      return json(route, {
        data: {
          id: 'adapter-1',
          capability: 'NOTIFICATION_EMAIL',
          ...request.postDataJSON(),
          updatedAt: '2026-08-31T10:00:00.000Z',
        },
      });
    }
    if (path === '/integrations/adapters/executions') {
      return json(route, {
        data: [
          {
            id: 'execution-1',
            capability: 'NOTIFICATION_EMAIL',
            provider: 'SIMULATOR',
            adapterVersion: '1',
            status: 'SUCCEEDED',
            attemptCount: 1,
            errorCode: null,
            durationMs: 28,
            createdAt: '2026-08-31T10:00:00.000Z',
          },
        ],
      });
    }
    if (path === '/integrations/adapters/email-events') {
      return json(route, {
        data: [
          {
            webhookEventId: 'event-1',
            provider: 'SIMULATOR',
            eventType: 'DELIVERED',
            errorCode: null,
            occurredAt: '2026-08-31T10:01:00.000Z',
          },
        ],
      });
    }
    if (path === '/integrations/fiscal/configuration') {
      return json(route, {
        data: {
          countryCode: 'MX',
          configuration: { providerProfile: 'SIMULATOR', enabled: true },
          contract: { version: '1' },
          validation: { valid: true, missingRequirements: [] },
        },
      });
    }
    if (path === '/integrations/fiscal/simulator/documents') return json(route, { data: [] });
    if (path === '/integrations/erp/v1/contract') {
      return json(route, { message: 'ERP temporalmente no disponible' }, 503);
    }
    if (path === '/integrations/psp/v1/contract') {
      return json(route, {
        data: { version: '1', activeProvider: { mode: 'SIMULATOR' } },
      });
    }
    if (path === '/integrations/psp/v1/payments') return json(route, { data: [] });
    if (path === '/integrations/accounting/v1/contract') {
      return json(route, { data: { journalStatus: 'CANDIDATE_NOT_POSTED' } });
    }
    if (path === '/integrations/accounting/v1/config') {
      return json(route, { data: { provider: 'SIMULATOR' } });
    }
    if (path === '/integrations/accounting/v1/events') return json(route, { data: [] });
    if (path === '/integrations/whatsapp/v1/contract') {
      return json(route, { data: { templates: ['WHATSAPP_SALE_RECEIPT'] } });
    }
    if (path === '/integrations/whatsapp/v1/consents') return json(route, { data: [] });
    if (path === '/integrations/whatsapp/v1/messages') return json(route, { data: [] });
    return json(route, { message: `Unhandled ${request.method()} ${path}` }, 404);
  });
  return writes;
}

test('manages adapters securely while isolating an unavailable provider', async ({
  page,
}, testInfo) => {
  const writes = await mockIntegrations(page);
  await page.goto('./administracion/integraciones');

  await expect(page.getByRole('heading', { name: 'Integraciones', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Fiscalidad' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'ERP' })).toBeVisible();
  await expect(page.getByText('El resto de integraciones continúa disponible.')).toBeVisible();
  await expect(page.getByText('1 con atención')).toBeVisible();
  await expectAccessible(page, 'Resumen de integraciones');
  await page.screenshot({ path: testInfo.outputPath('integrations-overview.png'), fullPage: true });

  await page.getByRole('button', { name: 'Adaptadores' }).click();
  await expect(page.getByText('Referencia configurada')).toBeVisible();
  await expect(page.getByText('provider-private-key')).toHaveCount(0);
  await page.getByLabel('Adaptador activo').check();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.locator('.notice[role="status"]')).toContainText(
    'Correo electrónico actualizado',
  );
  expect(writes).toEqual(['/integrations/adapters/NOTIFICATION_EMAIL']);
  await expectAccessible(page, 'Administración de adaptadores');
  await page.screenshot({ path: testInfo.outputPath('integrations-adapters.png'), fullPage: true });

  await page.getByRole('button', { name: 'Actividad' }).click();
  await expect(page.getByText('DELIVERED')).toBeVisible();
  await expect(page.getByText('SUCCEEDED')).toBeVisible();
  await expectViewportFit(page, 'Consola de integraciones');
  await page.screenshot({ path: testInfo.outputPath('integrations.png'), fullPage: true });
});
