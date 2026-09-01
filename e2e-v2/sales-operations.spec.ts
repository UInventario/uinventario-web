import { expect, test, type Page, type Route } from '@playwright/test';

const product = {
  id: 'product-1',
  name: 'Café de altura',
  sku: 'CAF-01',
  availableQuantity: '12.000',
  minimumQuantity: '1',
  quantityPrecision: 0,
};
const customer = { id: 'customer-1', name: 'Ana López', identifier: 'ANA-01' };
const location = { id: 'location-1', name: 'Piso de venta', code: 'PV-01' };

interface MockState {
  quotations: ReturnType<typeof quotation>[];
  orderStatus: 'DRAFT' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'DELIVERED';
  fulfillmentStatus: 'PENDING' | 'PREPARING' | 'READY' | 'DISPATCHED' | 'DELIVERED';
  trackingStatus: 'LABEL_READY' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | null;
  reservationAttempts: number;
  reservations: ReturnType<typeof reservation>[];
  writes: Array<{ path: string; body: unknown; key?: string }>;
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockOperations(page: Page): Promise<MockState> {
  const state: MockState = {
    quotations: [],
    orderStatus: 'DRAFT',
    fulfillmentStatus: 'PENDING',
    trackingStatus: null,
    reservationAttempts: 0,
    reservations: [],
    writes: [],
  };
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    const method = request.method();
    const body = request.postDataJSON();
    const key = request.headers()['idempotency-key'];
    if (path === '/auth/sessions/current') return json(route, session());
    if (path === '/organization/branches') return json(route, { data: [] });
    if (path === '/customers') return json(route, list([customer]));
    if (path === '/products') return json(route, list([product]));
    if (path === '/inventory/locations') return json(route, envelope([location]));
    if (path === '/inventory/stock') {
      return json(route, {
        data: [{ product: { id: product.id }, availableQuantity: product.availableQuantity }],
        meta: {
          pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
          valuation: { currency: 'MXN' },
        },
      });
    }
    if (path === '/pos/payment-options') {
      return json(route, envelope({ methods: ['CASH', 'CARD'], nonCashProvider: 'SIMULATOR' }));
    }
    if (path === '/pos/cart/quote' && method === 'POST') return json(route, envelope(cartQuote()));
    if (path === '/quotations' && method === 'GET') return json(route, list(state.quotations));
    if (path === '/quotations' && method === 'POST') {
      state.writes.push({ path, body, key });
      state.quotations = [quotation()];
      return json(route, envelope(state.quotations[0]), 201);
    }
    if (path === '/quotations/quotation-1/preview') {
      return json(route, envelope(quotationPreview()));
    }
    if (path === '/quotations/quotation-1/convert') {
      state.writes.push({ path, body, key });
      state.quotations = [{ ...quotation(), status: 'CONVERTED', sale: sale() }];
      return json(
        route,
        envelope({ quotation: state.quotations[0], sale: sale(), differences: [] }),
      );
    }
    if (path === '/reservations' && method === 'GET') {
      return json(route, envelope(state.reservations));
    }
    if (path === '/reservations' && method === 'POST') {
      state.reservationAttempts += 1;
      state.writes.push({ path, body, key });
      if (state.reservationAttempts === 1) {
        return json(
          route,
          { code: 'PRODUCT_RESERVATION_INSUFFICIENT_STOCK', message: 'stock' },
          409,
        );
      }
      state.reservations = [reservation()];
      return json(route, envelope(state.reservations[0]), 201);
    }
    if (path === '/orders' && method === 'GET') return json(route, orderList([order(state)]));
    if (path === '/orders/order-1' && method === 'GET') return json(route, envelope(order(state)));
    if (path === '/shipping/v1/contract') return json(route, envelope(shippingContract()));
    if (path === '/shipping/v1/orders/order-1/quote') {
      return json(
        route,
        envelope({
          quoteReference: 'SHIP-Q-1',
          service: 'Entrega local',
          amount: '75.00',
          currency: 'MXN',
          estimatedDeliveryAt: '2026-09-01T20:00:00.000Z',
        }),
      );
    }
    if (path === '/shipping/v1/orders/order-1/poll') {
      state.trackingStatus = body.scenario === 'TIMEOUT' ? state.trackingStatus : body.scenario;
      state.writes.push({ path, body, key });
      return json(route, envelope(order(state)));
    }
    const transition = path.match(
      /^\/orders\/order-1\/(confirm|prepare|ready|dispatch|deliver)$/,
    )?.[1];
    if (transition) {
      state.writes.push({ path, body, key });
      advance(state, transition);
      return json(route, envelope(order(state)));
    }
    return json(route, { code: 'NOT_FOUND', message: `Unhandled ${method} ${path}` }, 404);
  });
  return state;
}

test('creates and converts a quotation without capturing the sale again', async ({ page }) => {
  const state = await mockOperations(page);
  await page.goto('./ventas/operaciones/cotizaciones');
  await page.getByRole('button', { name: 'Nueva cotización' }).click();
  const editor = page.getByRole('dialog', { name: 'Nueva cotización' });
  await editor.getByLabel('Cliente (opcional)').selectOption(customer.id);
  await editor.locator('.lines select').selectOption(product.id);
  await editor.getByRole('button', { name: 'Guardar cotización' }).click();
  await expect(page.getByRole('heading', { name: 'COT-0001' })).toBeVisible();
  await page.getByRole('button', { name: 'Convertir' }).click();
  const conversion = page.getByRole('dialog', { name: 'Convertir COT-0001' });
  await expect(conversion.getByText('Diferencias encontradas')).toBeVisible();
  await conversion.getByRole('checkbox').check();
  await conversion.getByLabel('Efectivo recibido').fill('150.00');
  await conversion.getByRole('button', { name: 'Convertir en venta' }).click();
  await expect(page.getByText(/convertida en V-0001/)).toBeVisible();

  expect(state.writes[0]?.body).toMatchObject({
    customerId: customer.id,
    lines: [{ productId: product.id, quantity: '1' }],
  });
  expect(state.writes[1]?.body).toMatchObject({ version: 1, acceptDifferences: true });
  expect(state.writes.every(({ key }) => key?.startsWith('web-'))).toBe(true);
});

test('moves a delivery order through preparation, tracking, and final sale', async ({
  page,
}, testInfo) => {
  const state = await mockOperations(page);
  await page.goto('./ventas/operaciones/pedidos');
  await page.getByRole('button', { name: 'Gestionar' }).click();
  await page.getByRole('button', { name: 'Confirmar y reservar' }).click();
  await page.getByRole('button', { name: 'Iniciar preparación' }).click();
  await expect(
    page
      .getByRole('dialog', { name: 'PED-0001' })
      .getByText('operador@example.com', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Marcar listo' }).click();
  await page.getByRole('button', { name: 'Cotizar envío' }).click();
  await expect(page.getByText('Entrega local')).toBeVisible();
  await page.getByRole('button', { name: 'Despachar' }).click();
  await expect(page.getByText('TRACK-001', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Transportista entregó' }).click();
  await page.getByRole('button', { name: 'Completar entrega y venta' }).click();
  await expect(page.getByText(/entregado y convertido en venta V-0001/)).toBeVisible();
  await expect(page.getByText('Entregado', { exact: true }).first()).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath(`order-delivered-${testInfo.project.name}.png`),
    fullPage: true,
  });
  expect(state.orderStatus).toBe('DELIVERED');
  expect(state.writes.map(({ path }) => path)).toEqual(
    expect.arrayContaining([
      '/orders/order-1/confirm',
      '/orders/order-1/prepare',
      '/orders/order-1/ready',
      '/orders/order-1/dispatch',
      '/shipping/v1/orders/order-1/poll',
      '/orders/order-1/deliver',
    ]),
  );
});

test('shows a stock conflict in context, then creates a visible reservation', async ({
  page,
}, testInfo) => {
  const state = await mockOperations(page);
  await page.goto('./ventas/operaciones/reservas');
  await page.getByRole('button', { name: 'Nueva reserva' }).click();
  const editor = page.getByRole('dialog', { name: 'Nueva reserva' });
  await editor.getByLabel('Cliente').selectOption(customer.id);
  await editor.getByLabel('Ubicación de stock').selectOption(location.id);
  await editor.locator('.lines select').selectOption(product.id);
  await editor.getByRole('button', { name: 'Crear reserva' }).click();
  await expect(editor.getByRole('alert')).toContainText('No hay stock disponible suficiente');
  await editor.getByRole('button', { name: 'Crear reserva' }).click();
  await expect(page.getByText('Reserva RES-0001 creada.')).toBeVisible();
  await expect(page.getByText('Stock separado', { exact: true })).toBeVisible();
  await expect(page.getByText('operador@example.com', { exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath(`sales-operations-${testInfo.project.name}.png`),
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
    false,
  );
  expect(state.writes.at(-1)?.key).toMatch(/^web-/);
});

function session() {
  return {
    data: {
      user: {
        id: 'user-1',
        email: 'operador@example.com',
        roles: ['ADMIN'],
        permissions: ['SALES_MANAGE'],
      },
      tenant: { id: 'tenant-1', name: 'Café Central' },
      context: {
        branch: { id: 'branch-1', name: 'Centro' },
        warehouse: { id: 'warehouse-1', name: 'Principal' },
        cashRegister: { id: 'register-1', name: 'Caja 1', code: 'CAJA-01' },
      },
      nextStep: 'APPLICATION',
    },
    meta: { apiVersion: '1', sessionExpiresAt: new Date(Date.now() + 3_600_000).toISOString() },
  };
}

function envelope<T>(data: T) {
  return { data, meta: { apiVersion: '1' } };
}

function list<T>(data: readonly T[]) {
  return {
    data,
    meta: {
      pagination: { page: 1, pageSize: 20, total: data.length, totalPages: data.length ? 1 : 0 },
    },
  };
}

function orderList(data: unknown[]) {
  return list(data);
}

function cartQuote() {
  return {
    currency: 'MXN',
    lines: [
      {
        product,
        quantity: '1',
        availableQuantity: '12.000',
        unitPrice: '120.00',
        total: '139.20',
      },
    ],
    totals: {
      gross: '120.00',
      discount: '0.00',
      subtotal: '120.00',
      tax: '19.20',
      total: '139.20',
    },
  };
}

function quotation() {
  return {
    id: 'quotation-1',
    quotationNumber: 'COT-0001',
    status: 'ACTIVE' as const,
    version: 1,
    channel: 'WEB' as const,
    customer,
    reservation: null,
    sale: null,
    currency: 'MXN',
    lines: cartQuote().lines,
    totals: cartQuote().totals,
    validUntil: '2026-09-02T20:00:00.000Z',
    notes: null,
    createdAt: '2026-08-31T20:00:00.000Z',
    updatedAt: '2026-08-31T20:00:00.000Z',
    convertedAt: null,
  };
}

function quotationPreview() {
  return {
    quotation: quotation(),
    recalculated: cartQuote(),
    differences: [
      { product, field: 'UNIT_PRICE', quoted: '118.00', current: '120.00', blocking: false },
    ],
    canConvert: true,
  };
}

function sale() {
  return { id: 'sale-1', receiptNumber: 'V-0001' };
}

function reservation() {
  return {
    id: 'reservation-1',
    reservationNumber: 'RES-0001',
    status: 'ACTIVE' as const,
    customer,
    context: {
      branch: { id: 'branch-1', name: 'Centro' },
      warehouse: { id: 'warehouse-1', name: 'Principal' },
      location,
    },
    responsible: { id: 'user-1', email: 'operador@example.com' },
    expiresAt: '2026-09-01T20:00:00.000Z',
    createdAt: '2026-08-31T20:00:00.000Z',
    closedAt: null,
    closureReason: null,
    sale: null,
    lines: [{ id: 'reservation-line-1', product, quantity: '1', serialNumbers: [] }],
  };
}

function shippingContract() {
  return {
    provider: { key: 'simulator', version: '1', mode: 'SIMULATOR', production: false },
    operations: ['QUOTE', 'DISPATCH', 'POLL', 'CANCEL'],
    fallback: { manualOperationAvailable: true },
  };
}

function order(state: MockState) {
  const responsible =
    state.orderStatus === 'DRAFT' || state.orderStatus === 'CONFIRMED'
      ? null
      : { id: 'user-1', email: 'operador@example.com' };
  return {
    id: 'order-1',
    orderNumber: 'PED-0001',
    channel: 'WEB',
    priority: 'HIGH',
    status: state.orderStatus,
    version:
      ['DRAFT', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED'].indexOf(state.orderStatus) + 1,
    customer,
    context: {
      branch: { id: 'branch-1', name: 'Centro' },
      warehouse: { id: 'warehouse-1', name: 'Principal' },
      cashRegister: { id: 'register-1', name: 'Caja 1', code: 'CAJA-01' },
      location,
    },
    currency: 'MXN',
    totals: { subtotal: '120.00', tax: '19.20', total: '214.20' },
    expiresInHours: 48,
    fulfillment: {
      method: 'DELIVERY',
      status: state.fulfillmentStatus,
      deliveryCost: '75.00',
      window: { start: '2026-09-01T18:00:00.000Z', end: '2026-09-01T20:00:00.000Z' },
      address: {
        recipientNameMasked: 'Ana L.',
        phoneMasked: '***1234',
        summary: 'Centro, CDMX',
        countryCode: 'MX',
      },
      carrier:
        state.fulfillmentStatus === 'DISPATCHED' || state.fulfillmentStatus === 'DELIVERED'
          ? {
              code: 'SIMULATED',
              name: 'Simulador',
              trackingReference: 'TRACK-001',
              trackingStatus: state.trackingStatus,
              manualActionRequired: false,
              attempts: 1,
              lastErrorCode: null,
            }
          : null,
      responsible: {
        preparation: responsible,
        delivery: state.orderStatus === 'DELIVERED' ? responsible : null,
      },
    },
    reservation:
      state.orderStatus === 'DRAFT'
        ? null
        : {
            id: 'reservation-1',
            reservationNumber: 'RES-0001',
            status: state.orderStatus === 'DELIVERED' ? 'CONSUMED' : 'ACTIVE',
          },
    sale: state.orderStatus === 'DELIVERED' ? sale() : null,
    lines: [{ id: 'line-1', product, quantity: '1', serialNumbers: [], total: '139.20' }],
    payments: [
      {
        id: 'payment-1',
        method: 'CASH',
        amount: '214.20',
        amountReceived: '220.00',
        reference: null,
        status: state.orderStatus === 'DELIVERED' ? 'COMPLETED' : 'PLANNED',
      },
    ],
    transitions: [],
    cancellationReason: null,
    createdAt: '2026-08-31T20:00:00.000Z',
    updatedAt: '2026-08-31T20:00:00.000Z',
  };
}

function advance(state: MockState, action: string): void {
  if (action === 'confirm') state.orderStatus = 'CONFIRMED';
  if (action === 'prepare') {
    state.orderStatus = 'PREPARING';
    state.fulfillmentStatus = 'PREPARING';
  }
  if (action === 'ready') {
    state.orderStatus = 'READY';
    state.fulfillmentStatus = 'READY';
  }
  if (action === 'dispatch') {
    state.fulfillmentStatus = 'DISPATCHED';
    state.trackingStatus = 'LABEL_READY';
  }
  if (action === 'deliver') {
    state.orderStatus = 'DELIVERED';
    state.fulfillmentStatus = 'DELIVERED';
  }
}
