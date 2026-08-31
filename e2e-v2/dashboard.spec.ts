import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

const permissions = [
  'SALES_MANAGE',
  'INVENTORY_VIEW',
  'PURCHASE_ORDERS_MANAGE',
  'INVENTORY_VALUATION_MANAGE',
  'NOTIFICATIONS_VIEW',
  'NOTIFICATIONS_MANAGE',
] as const;
const requestLog = new WeakMap<Page, string[]>();

const forecast = {
  id: 'forecast-1',
  branch: { id: 'branch-1', name: 'Centro', timezone: 'America/Mexico_City' },
  status: 'READY',
  asOfDate: '2026-08-30',
  horizonDays: 14,
  model: 'WEEKDAY_BASELINE_V1',
  assumptions: ['El patrón semanal reciente representa la demanda futura.'],
  generatedAt: '2026-08-30T18:00:00.000Z',
  items: [
    {
      product: { id: 'product-1', name: 'Café de especialidad', sku: 'CAF-01' },
      status: 'SUFFICIENT',
      quality: {
        coverageDays: 60,
        daysWithDemand: 30,
        totalDemand: 120,
        minimum: { coverageDays: 42, daysWithDemand: 12, totalDemand: 20 },
        backtest: { samples: 14, meanAbsoluteError: 1.2 },
        drift: { ratio: 1.05, status: 'STABLE' },
      },
      forecast: {
        horizonDays: 14,
        expectedDemand: 28,
        interval: { confidence: 'APPROXIMATE_80', lower: 22, upper: 34 },
        availableQuantity: 10,
        suggestedReorderQuantity: 18,
      },
    },
  ],
  summary: { sufficient: 1, insufficient: 0, driftWarnings: 0 },
};

const notification = {
  id: 'notification-1',
  eventType: 'STOCK_LOW',
  title: 'Café con stock bajo',
  body: 'Quedan 2 unidades disponibles en Piso de venta.',
  severity: 'WARNING',
  digestCount: 1,
  sourceOccurredAt: '2026-08-30T18:00:00.000Z',
  readAt: null as string | null,
  createdAt: '2026-08-30T18:01:00.000Z',
};

async function json(route: Route, body: unknown): Promise<void> {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockDashboard(page: Page, requests: string[]): Promise<void> {
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    requests.push(`${request.method()} ${path}${url.search}`);
    if (path === '/auth/sessions/current') {
      return json(route, {
        data: {
          user: { id: 'user-1', email: 'admin@example.com', roles: ['ADMIN'], permissions },
          tenant: { id: 'tenant-1', name: 'Tienda Central' },
          context: {
            branch: { id: 'branch-1', name: 'Centro' },
            warehouse: { id: 'warehouse-1', name: 'Principal' },
            cashRegister: { id: 'register-1', name: 'Caja 1', code: 'CAJA-1' },
          },
          nextStep: 'APPLICATION',
        },
        meta: { apiVersion: '1', sessionExpiresAt: '2026-08-31T23:00:00.000Z' },
      });
    }
    if (path === '/organization/branches') {
      return json(route, {
        data: [
          {
            id: 'branch-1',
            name: 'Centro',
            timezone: 'America/Mexico_City',
            active: true,
            warehouses: [{ id: 'warehouse-1', name: 'Principal', active: true, locations: [] }],
            cashRegisters: [{ id: 'register-1', name: 'Caja 1', code: 'CAJA-1' }],
          },
        ],
        meta: { apiVersion: '1' },
      });
    }
    if (path === '/pos/reports/sales-cash') {
      return json(route, {
        data: {
          summary: {
            sales: { completed: 3, net: '540.00' },
            reconciliation: { matches: true },
          },
        },
        meta: { apiVersion: '1' },
      });
    }
    if (path === '/inventory/stock-alerts') {
      const total = url.searchParams.get('status') === 'OUT_OF_STOCK' ? 1 : 4;
      return json(route, {
        data: [],
        meta: { apiVersion: '1', pagination: { page: 1, pageSize: 1, total, totalPages: total } },
      });
    }
    if (path === '/purchase-orders') {
      return json(route, {
        data: [],
        meta: { apiVersion: '1', pagination: { page: 1, pageSize: 1, total: 6, totalPages: 6 } },
      });
    }
    if (path === '/forecasting/demand/latest') {
      return json(route, { data: forecast, meta: { apiVersion: '1' } });
    }
    if (path === '/forecasting/demand/runs') {
      const body = request.postDataJSON() as { horizonDays: number };
      return json(route, {
        data: { ...forecast, horizonDays: body.horizonDays },
        meta: { apiVersion: '1', idempotentReplay: false },
      });
    }
    if (path === '/notifications' && request.method() === 'GET') {
      const type = url.searchParams.get('eventType');
      const matchesType = !type || type === notification.eventType;
      const matchesReadState =
        url.searchParams.get('unreadOnly') !== 'true' || !notification.readAt;
      const items = matchesType && matchesReadState ? [notification] : [];
      return json(route, {
        data: items,
        meta: {
          apiVersion: '1',
          unread: notification.readAt ? 0 : 1,
          pagination: { page: 1, pageSize: 50, total: items.length, totalPages: 1 },
        },
      });
    }
    if (path === '/notifications/refresh') {
      return json(route, {
        data: { reconciliation: { created: 0, deduplicated: 1 }, delivery: { sent: 0, failed: 0 } },
        meta: { apiVersion: '1' },
      });
    }
    if (path === '/notifications/notification-1/read') {
      notification.readAt = '2026-08-30T19:00:00.000Z';
      return json(route, { data: { id: notification.id, read: true }, meta: { apiVersion: '1' } });
    }
    if (path === '/notifications/read-all') {
      notification.readAt = '2026-08-30T19:00:00.000Z';
      return json(route, { data: { changed: 1 }, meta: { apiVersion: '1' } });
    }
    if (path === '/notifications/preferences' && request.method() === 'GET') {
      return json(route, {
        data: {
          preferences: [
            {
              id: 'preference-1',
              recipient: { id: 'user-1', email: 'admin@example.com' },
              eventType: 'STOCK_LOW',
              enabled: true,
              channels: { inApp: true, email: false, push: false },
              frequency: 'IMMEDIATE',
              updatedAt: '2026-08-30T18:00:00.000Z',
            },
          ],
          recipients: [{ id: 'user-1', email: 'admin@example.com' }],
        },
        meta: { apiVersion: '1' },
      });
    }
    if (path === '/notifications/preferences' && request.method() === 'PUT') {
      const body = request.postDataJSON() as {
        preferences: Array<{
          recipientUserId: string;
          eventType: string;
          enabled: boolean;
          inApp: boolean;
          email: boolean;
          push: boolean;
          frequency: string;
        }>;
      };
      return json(route, {
        data: body.preferences.map((item, index) => ({
          id: `preference-${index + 1}`,
          recipient: { id: item.recipientUserId, email: 'admin@example.com' },
          eventType: item.eventType,
          enabled: item.enabled,
          channels: { inApp: item.inApp, email: item.email, push: item.push },
          frequency: item.frequency,
          updatedAt: '2026-08-30T19:00:00.000Z',
        })),
        meta: { apiVersion: '1' },
      });
    }
    if (path === '/notifications/deliveries') {
      return json(route, { data: [], meta: { apiVersion: '1' } });
    }
    if (path === '/notifications/deliveries/retry') {
      return json(route, { data: { sent: 0, failed: 0 }, meta: { apiVersion: '1' } });
    }
    await route.abort('failed');
  });
}

test.beforeEach(async ({ page }) => {
  notification.readAt = null;
  const requests: string[] = [];
  await mockDashboard(page, requests);
  requestLog.set(page, requests);
});

test('keeps period and widget choices in URL while loading only compact aggregates', async ({
  page,
}) => {
  await page.goto('./dashboard');
  await expect(page.getByRole('heading', { name: 'Resumen operativo' })).toBeVisible();
  await expect(page).toHaveURL(
    /dashboard\/resumen\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}&widgets=/,
  );
  await expect(page.getByText('540.00')).toBeVisible();
  await expect(page.getByText('4').first()).toBeVisible();
  await expect(page.getByText('6').first()).toBeVisible();

  await page.getByLabel('Desde').fill('2026-08-01');
  await page.getByRole('button', { name: 'Aplicar periodo' }).click();
  await page.getByText('Widgets', { exact: true }).click();
  await page.getByRole('checkbox', { name: 'Compras', exact: true }).uncheck();
  await expect(page).toHaveURL(/from=2026-08-01/);
  await expect(page).not.toHaveURL(/widgets=[^&]*purchases/);
  await page.reload();
  await expect(page.getByText('Órdenes de compra')).toHaveCount(0);
  await expect(page.getByLabel('Desde')).toHaveValue('2026-08-01');

  const requests = requestLog.get(page) ?? [];
  expect(
    requests.some(
      (value) => value.includes('/pos/reports/sales-cash') && value.includes('pageSize=1'),
    ),
  ).toBe(true);
  expect(
    requests.some(
      (value) => value.includes('/inventory/stock-alerts') && value.includes('pageSize=1'),
    ),
  ).toBe(true);
});

test('explains forecasts and lets users filter, read and follow notifications', async ({
  page,
}) => {
  await page.goto('./dashboard/pronostico');
  await expect(page.getByText('Es una recomendación, no una compra automática.')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Café de especialidad CAF-01' })).toBeVisible();
  const horizon = page.getByLabel('Horizonte');
  await horizon.selectOption('30');
  await expect(horizon).toHaveValue('30');
  const generated = page.waitForResponse(
    (response) =>
      response.url().includes('/forecasting/demand/runs') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Generar pronóstico' }).click();
  await generated;
  await expect(horizon).toHaveValue('30');

  await page.getByRole('link', { name: 'Notificaciones' }).click();
  await page.getByLabel('Tipo de evento').selectOption('STOCK_LOW');
  await page.getByLabel('Sólo pendientes de lectura').check();
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(page).toHaveURL(/type=STOCK_LOW/);
  await expect(page).toHaveURL(/unread=true/);
  await expect(page.getByText('Café con stock bajo')).toBeVisible();
  const origin = page.getByRole('link', { name: 'Revisar alertas de inventario' });
  await expect(origin).toHaveAttribute('href', /inventario\/control\?view=alerts/);
  await page.getByRole('button', { name: 'Marcar leída' }).click();
  await expect(page.getByText('Todo al día')).toBeVisible();

  await page.getByRole('button', { name: 'Reglas y entregas' }).click();
  await expect(page.getByRole('heading', { name: 'Destinatarios y canales' })).toBeVisible();
  await page.getByLabel('Email').check();
  await page.getByRole('button', { name: 'Guardar reglas' }).click();
  await expect(page.getByText('Reglas de notificación guardadas.')).toBeVisible();
});

test('keeps every focused dashboard surface inside the viewport', async ({ page }, testInfo) => {
  for (const [path, heading, capture] of [
    ['./dashboard', 'Resumen operativo', 'overview'],
    ['./dashboard/pronostico', 'Pronóstico de demanda', 'forecast'],
    ['./dashboard/notificaciones', 'Notificaciones', 'notifications'],
    [
      './dashboard/notificaciones?panel=settings',
      'Destinatarios y canales',
      'notification-settings',
    ],
  ] as const) {
    await page.goto(path);
    const surface = page.getByRole('heading', { name: heading });
    await expect(surface).toBeVisible();
    const fit = await page.evaluate(() => {
      const main = document.querySelector('main');
      const rect = main?.getBoundingClientRect();
      return {
        documentScrollsX:
          document.documentElement.scrollWidth > document.documentElement.clientWidth,
        windowScrollY: window.scrollY,
        mainScrollTop: main?.scrollTop ?? -1,
        mainLeft: rect?.left ?? -1,
        mainRight: rect?.right ?? Number.POSITIVE_INFINITY,
        viewportWidth: window.innerWidth,
      };
    });
    expect(fit.documentScrollsX).toBe(false);
    expect(fit.windowScrollY).toBe(0);
    expect(fit.mainScrollTop).toBe(0);
    expect(fit.mainLeft).toBeGreaterThanOrEqual(0);
    expect(fit.mainRight).toBeLessThanOrEqual(fit.viewportWidth);
    if (process.env['VISUAL_QA'] === '1') {
      await page.screenshot({
        path: `test-results/visual-dashboard-${testInfo.project.name}-${capture}.png`,
        fullPage: false,
      });
    }
  }
});
