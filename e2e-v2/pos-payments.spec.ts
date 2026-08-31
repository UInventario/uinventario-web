import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

const product = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Café de especialidad',
  sku: 'CAF-119',
  barcode: '750100000119',
  withoutCode: false,
  stockBehavior: 'TRACKED',
  taxBehavior: 'STANDARD',
  baseUnit: 'UNIT',
  quantityPrecision: 0,
  quantityRounding: 'HALF_UP',
  minimumQuantity: '1.000',
  trackLots: false,
  trackSerials: false,
  price: '119.90',
  active: true,
  sellable: true,
};

const branch = {
  id: 'branch-1',
  name: 'Centro',
  warehouses: [{ id: 'warehouse-1', name: 'Principal', active: true, locations: [] }],
  cashRegisters: [{ id: 'register-1', name: 'Caja 1', code: 'CAJA-01' }],
};

const credit = (available: string) => ({
  enabled: true,
  limit: '1000.00',
  currency: 'MXN',
  maxInstallments: 6,
  balance: '100.00',
  available,
  overdueAmount: '0.00',
  status: 'AVAILABLE',
});

const customers = [
  {
    id: 'customer-low',
    name: 'Cliente sin límite',
    identifier: 'LOW-01',
    email: null,
    phone: null,
    active: true,
    privacyStatus: 'ACTIVE',
    credit: credit('50.00'),
  },
  {
    id: 'customer-ok',
    name: 'Ana Crédito',
    identifier: 'ANA-01',
    email: 'ana@example.com',
    phone: null,
    active: true,
    privacyStatus: 'ACTIVE',
    credit: credit('900.00'),
  },
];

interface SaleWrite {
  readonly path: string;
  readonly body: Record<string, unknown>;
  readonly idempotencyKey: string | null;
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

function session() {
  return {
    data: {
      user: {
        id: 'user-1',
        email: 'cashier@example.com',
        roles: ['ADMIN'],
        permissions: ['SALES_MANAGE', 'SALES_CREDIT'],
      },
      tenant: { id: 'tenant-1', name: 'Tienda Central' },
      context: {
        branch: { id: branch.id, name: branch.name },
        warehouse: { id: 'warehouse-1', name: 'Principal' },
        cashRegister: branch.cashRegisters[0],
      },
      nextStep: 'APPLICATION',
    },
    meta: { apiVersion: '1', sessionExpiresAt: new Date(Date.now() + 3_600_000).toISOString() },
  };
}

function quote() {
  return {
    data: {
      context: {
        branch: { id: branch.id, name: branch.name },
        warehouse: { id: 'warehouse-1', name: 'Principal' },
        cashRegister: branch.cashRegisters[0],
      },
      currency: 'MXN',
      taxRate: '0.0000',
      lines: [
        {
          product,
          quantity: '1.000',
          note: null,
          availableQuantity: '20.000',
          unitPrice: '119.90',
          priceSource: 'BASE',
          priceOverrideReason: null,
          priceList: null,
          grossTotal: '119.90',
          discount: { line: null, sale: null, total: '0.00' },
          promotions: [],
          subtotal: '119.90',
          tax: '0.00',
          total: '119.90',
        },
      ],
      totals: {
        gross: '119.90',
        lineDiscount: '0.00',
        promotionDiscount: '0.00',
        saleDiscount: '0.00',
        discount: '0.00',
        subtotal: '119.90',
        tax: '0.00',
        total: '119.90',
      },
    },
    meta: { apiVersion: '1' },
  };
}

function sale(body: Record<string, unknown>) {
  const paymentInputs =
    (body['payments'] as Array<Record<string, unknown>> | undefined) ??
    (body['payment'] ? [body['payment'] as Record<string, unknown>] : []);
  const payments = body['credit']
    ? [
        {
          id: 'payment-credit',
          method: 'CREDIT',
          status: 'PENDING',
          amountReceived: '119.90',
          amountApplied: '119.90',
          change: '0.00',
          reference: null,
          provider: 'INTERNAL_CREDIT',
          authorizationCode: null,
        },
      ]
    : paymentInputs.map((payment, index) => ({
        id: `payment-${index + 1}`,
        method: payment['method'],
        status: 'COMPLETED',
        amountReceived: String(payment['amountReceived'] ?? payment['amount'] ?? '119.90'),
        amountApplied: String(payment['amount'] ?? '119.90'),
        change:
          payment['method'] === 'CASH'
            ? (
                Number(payment['amountReceived'] ?? body['cashReceived']) -
                Number(payment['amount'] ?? '119.90')
              ).toFixed(2)
            : '0.00',
        reference: payment['reference'] ?? null,
        provider: payment['terminalOperationId'] ? 'SIMULATOR' : 'INTERNAL',
        authorizationCode: payment['terminalOperationId'] ? 'AUTH-001' : null,
      }));
  if (body['cashReceived']) {
    payments.push({
      id: 'payment-cash',
      method: 'CASH',
      status: 'COMPLETED',
      amountReceived: String(body['cashReceived']),
      amountApplied: '119.90',
      change: (Number(body['cashReceived']) - 119.9).toFixed(2),
      reference: null,
      provider: 'INTERNAL',
      authorizationCode: null,
    });
  }
  return {
    data: {
      id: 'sale-1',
      receiptNumber: 'V-000119',
      status: 'COMPLETED',
      currency: 'MXN',
      customer: body['customerId'] ? { id: body['customerId'], name: 'Ana Crédito' } : null,
      totals: quote().data.totals,
      payments,
      credit: body['credit']
        ? {
            accountId: 'account-1',
            originalAmount: '119.90',
            balance: '119.90',
            currency: 'MXN',
            termDays: 30,
            status: 'OPEN',
            dueDate: '2026-09-30',
            installments: Array.from(
              { length: (body['credit'] as { installmentCount: number }).installmentCount },
              (_, index) => ({
                number: index + 1,
                dueDate: '2026-09-30',
                amount: '39.97',
              }),
            ),
          }
        : null,
      createdAt: '2026-08-30T18:00:00.000Z',
    },
    meta: { apiVersion: '1' },
  };
}

async function mockPayments(page: Page, saleWrites: SaleWrite[]): Promise<void> {
  let terminalStatus = 'INDETERMINATE';
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');
    const method = route.request().method();
    if (path === '/auth/sessions/current') return json(route, session());
    if (path === '/organization/branches')
      return json(route, { data: [branch], meta: { apiVersion: '1' } });
    if (path === '/pos/register-shifts/current') {
      return json(route, {
        data: {
          id: 'shift-1',
          status: 'OPEN',
          branch: { id: branch.id, name: branch.name },
          cashRegister: branch.cashRegisters[0],
          openedBy: { id: 'user-1', email: 'cashier@example.com' },
          openingAmount: '1000.00',
          currency: 'MXN',
          openedAt: '2026-08-30T16:00:00.000Z',
        },
        meta: { apiVersion: '1' },
      });
    }
    if (path === '/products' && method === 'GET') {
      return json(route, {
        data: [product],
        meta: { pagination: { page: 1, pageSize: 24, total: 1, totalPages: 1 } },
      });
    }
    if (path === '/pos/cart/quote' && method === 'POST') return json(route, quote());
    if (path === '/pos/payment-options') {
      return json(route, {
        data: {
          methods: ['CASH', 'CARD', 'TRANSFER', 'VOUCHER'],
          nonCashProvider: 'SIMULATOR',
        },
        meta: { apiVersion: '1' },
      });
    }
    if (path === '/customers' && method === 'GET') {
      return json(route, {
        data: customers,
        meta: { pagination: { page: 1, pageSize: 12, total: 2, totalPages: 1 } },
      });
    }
    if (path === '/pos/payment-terminal/operations' && method === 'POST') {
      const body = route.request().postDataJSON() as { scenario: string };
      expect(route.request().headers()['idempotency-key']).toMatch(/^web-/);
      terminalStatus =
        body.scenario === 'INDETERMINATE'
          ? 'INDETERMINATE'
          : body.scenario === 'REJECT'
            ? 'DECLINED'
            : 'CAPTURED';
      return json(route, {
        data: {
          id: '33333333-3333-4333-8333-333333333333',
          provider: 'SIMULATOR',
          amount: '119.90',
          currency: 'MXN',
          status: terminalStatus,
          errorCode: terminalStatus === 'DECLINED' ? 'DECLINED_BY_SIMULATOR' : null,
          authorizationCode: terminalStatus === 'CAPTURED' ? 'AUTH-001' : null,
          queryCount: 0,
          saleId: null,
          updatedAt: '2026-08-30T18:00:00.000Z',
        },
        meta: { apiVersion: '1' },
      });
    }
    if (path === '/pos/payment-terminal/operations/33333333-3333-4333-8333-333333333333') {
      terminalStatus = 'CAPTURED';
      return json(route, {
        data: {
          id: '33333333-3333-4333-8333-333333333333',
          provider: 'SIMULATOR',
          amount: '119.90',
          currency: 'MXN',
          status: terminalStatus,
          errorCode: null,
          authorizationCode: 'AUTH-001',
          queryCount: 1,
          saleId: null,
          updatedAt: '2026-08-30T18:01:00.000Z',
        },
        meta: { apiVersion: '1' },
      });
    }
    if ((path === '/pos/sales/cash' || path === '/pos/sales') && method === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      saleWrites.push({
        path,
        body,
        idempotencyKey: route.request().headers()['idempotency-key'] ?? null,
      });
      return json(route, sale(body), 201);
    }
    throw new Error(`Request no simulada: ${method} ${path}`);
  });
}

async function openCheckout(page: Page): Promise<void> {
  await page.goto('./ventas/pos');
  await page.getByRole('button', { name: 'Agregar Café de especialidad' }).click();
  await page.getByRole('button', { name: 'Continuar al cobro' }).click();
  await expect(page.getByRole('dialog', { name: 'Completar venta' })).toBeVisible();
}

test('calculates cash change and completes only after API confirmation', async ({ page }) => {
  const writes: SaleWrite[] = [];
  await mockPayments(page, writes);
  await openCheckout(page);

  const checkout = page.getByRole('dialog', { name: 'Completar venta' });
  await checkout.getByLabel('Efectivo recibido').fill('200');
  await expect(checkout.getByText('$80.10')).toBeVisible();
  await checkout.getByRole('button', { name: 'Cobrar y completar venta' }).click();
  await expect(page.getByRole('dialog', { name: 'V-000119' })).toBeVisible();
  expect(writes[0]).toMatchObject({
    path: '/pos/sales/cash',
    body: { cashReceived: '200' },
  });
  expect(writes[0].idempotencyKey).toMatch(/^web-/);
});

test('submits an exact mixed payment and preserves both tender amounts', async ({ page }) => {
  const writes: SaleWrite[] = [];
  await mockPayments(page, writes);
  await openCheckout(page);

  const checkout = page.getByRole('dialog', { name: 'Completar venta' });
  await checkout.getByRole('button', { name: 'Mixto' }).click();
  await checkout.getByLabel('Parte en efectivo').fill('60');
  await checkout.getByLabel('Efectivo recibido').fill('70');
  await checkout.getByLabel('Referencia').fill('CARD-2026-001');
  await expect(checkout.getByText('$59.90')).toBeVisible();
  await checkout.getByRole('button', { name: 'Cobrar $119.90' }).click();
  expect(writes[0].body['payments']).toEqual([
    { method: 'CASH', amount: '60.00', amountReceived: '70' },
    { method: 'CARD', amount: '59.90', reference: 'CARD-2026-001' },
  ]);
});

test('resolves an indeterminate terminal payment before completing the sale', async ({ page }) => {
  const writes: SaleWrite[] = [];
  await mockPayments(page, writes);
  await openCheckout(page);

  const checkout = page.getByRole('dialog', { name: 'Completar venta' });
  await checkout.getByRole('button', { name: 'Terminal' }).click();
  await checkout.getByLabel('Escenario de prueba').selectOption('INDETERMINATE');
  await checkout.getByRole('button', { name: /Enviar.*terminal/ }).click();
  await expect(checkout.getByText('INDETERMINATE')).toBeVisible();
  await expect(checkout.getByText(/No repitas el cobro/)).toBeVisible();
  await checkout.getByRole('button', { name: 'Consultar estado' }).click();
  await expect(checkout.getByText('CAPTURED')).toBeVisible();
  await expect(checkout.getByRole('button', { name: 'Cerrar cobro' })).toBeDisabled();
  await checkout.getByRole('button', { name: 'Completar venta con pago confirmado' }).click();
  expect(writes[0].body['payment']).toEqual({
    method: 'CARD',
    amount: '119.90',
    terminalOperationId: '33333333-3333-4333-8333-333333333333',
  });
});

test('keeps the sale intact when the terminal rejects the payment', async ({ page }) => {
  const writes: SaleWrite[] = [];
  await mockPayments(page, writes);
  await openCheckout(page);

  const checkout = page.getByRole('dialog', { name: 'Completar venta' });
  await checkout.getByRole('button', { name: 'Terminal' }).click();
  await checkout.getByLabel('Escenario de prueba').selectOption('REJECT');
  await checkout.getByRole('button', { name: /Enviar.*terminal/ }).click();
  await expect(checkout.getByText('DECLINED')).toBeVisible();
  await expect(checkout.getByText(/venta no se registró/)).toBeVisible();
  expect(writes).toHaveLength(0);
  await checkout.getByRole('button', { name: 'Intentar otro cobro' }).click();
  await expect(checkout.getByRole('button', { name: /Enviar.*terminal/ })).toBeVisible();
});

test('requires an eligible customer and enforces the available credit limit', async ({ page }) => {
  const writes: SaleWrite[] = [];
  await mockPayments(page, writes);
  await openCheckout(page);

  const checkout = page.getByRole('dialog', { name: 'Completar venta' });
  await checkout.getByRole('button', { name: 'Crédito' }).click();
  await checkout.getByLabel('Buscar cliente para crédito').fill('cliente');
  await checkout.getByRole('button', { name: 'Buscar' }).click();
  await checkout.getByRole('button', { name: /Cliente sin límite/ }).click();
  await expect(checkout.getByText(/no cubre el total/i)).toBeVisible();
  await expect(checkout.getByRole('button', { name: 'Autorizar venta a crédito' })).toBeDisabled();
  await checkout.getByRole('button', { name: 'Cambiar cliente' }).click();
  await checkout.getByRole('button', { name: /Ana Crédito/ }).click();
  await checkout.getByLabel('Parcialidades').fill('3');
  await checkout.getByRole('button', { name: 'Autorizar venta a crédito' }).click();
  expect(writes[0].body).toMatchObject({
    customerId: 'customer-ok',
    credit: { installmentCount: 3 },
  });
});
