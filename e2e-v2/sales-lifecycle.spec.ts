import { expect, test, type Page, type Route } from '@playwright/test';
// prettier-ignore
const saleId = '11111111-1111-4111-8111-111111111111', lineId = '22222222-2222-4222-8222-222222222222', paymentId = '33333333-3333-4333-8333-333333333333';
// prettier-ignore
const suspendedId = '44444444-4444-4444-8444-444444444444', returnId = '55555555-5555-4555-8555-555555555555', productId = '66666666-6666-4666-8666-666666666666';
// prettier-ignore
const product = {
  id: productId, name: 'Café de altura', sku: 'CAF-ALT-01', barcode: '750100000009',
  withoutCode: false, stockBehavior: 'TRACKED', taxBehavior: 'STANDARD', baseUnit: 'UNIT',
  quantityPrecision: 0, quantityRounding: 'HALF_UP', minimumQuantity: '1.000',
  trackLots: false, trackSerials: false, price: '120.00', active: true, sellable: true,
};

function session(permissions: string[]) {
  return {
    data: {
      user: { id: 'user-1', email: 'cajera@example.com', roles: ['ADMIN'], permissions },
      tenant: { id: 'tenant-1', name: 'Café Central' },
      context: {
        branch: { id: 'branch-1', name: 'Centro' },
        warehouse: { id: 'warehouse-1', name: 'Principal' },
        cashRegister: { id: 'register-1', name: 'Caja 1', code: 'CAJA-01' },
      },
      nextStep: 'APPLICATION',
    },
    meta: { apiVersion: '1', sessionExpiresAt: '2026-08-31T03:00:00.000Z' },
  };
}

function saleDetail(status: 'COMPLETED' | 'VOIDED' = 'COMPLETED') {
  return {
    id: saleId,
    receiptNumber: 'V-2026-0042',
    status,
    context: {
      branch: { id: 'branch-1', name: 'Centro' },
      warehouse: { id: 'warehouse-1', name: 'Principal' },
      cashRegister: { id: 'register-1', name: 'Caja 1', code: 'CAJA-01' },
    },
    user: { id: 'user-1', email: 'cajera@example.com' },
    customer: { id: 'customer-1', name: 'Ana López', identifier: 'ANA-01' },
    currency: 'MXN',
    lines: [
      {
        id: lineId,
        product,
        quantity: '2.000',
        note: null,
        unitPrice: '120.00',
        subtotal: '240.00',
        tax: '38.40',
        total: '278.40',
      },
    ],
    totals: {
      gross: '278.40',
      discount: '0.00',
      subtotal: '240.00',
      tax: '38.40',
      total: '278.40',
      grossProfit: null,
    },
    payments: [
      {
        id: paymentId,
        method: 'CARD',
        status: status === 'VOIDED' ? 'REVERSED' : 'COMPLETED',
        amountReceived: '278.40',
        amountApplied: '278.40',
        change: '0.00',
        reference: 'TERM-0042',
        provider: 'SIMULATOR',
        authorizationCode: 'AUTH-42',
      },
    ],
    movements: [
      {
        id: 'movement-1',
        type: status === 'VOIDED' ? 'SALE_VOID' : 'SALE',
        saleLineId: lineId,
        product,
        location: { id: 'location-1', name: 'Piso de venta', code: 'PV-01' },
        quantityChange: status === 'VOIDED' ? '2.000' : '-2.000',
        resultingQuantity: status === 'VOIDED' ? '10.000' : '8.000',
        reference: 'V-2026-0042',
        createdAt: '2026-08-30T20:00:00.000Z',
      },
    ],
    createdAt: '2026-08-30T20:00:00.000Z',
    void:
      status === 'VOIDED'
        ? {
            reason: 'Cobro duplicado',
            user: { id: 'user-1', email: 'cajera@example.com' },
            voidedAt: '2026-08-30T20:10:00.000Z',
          }
        : null,
  };
}

// prettier-ignore
const summary = {
  id: saleId, receiptNumber: 'V-2026-0042', status: 'COMPLETED',
  user: { id: 'user-1', email: 'cajera@example.com' },
  customer: { id: 'customer-1', name: 'Ana López', identifier: 'ANA-01' },
  cashRegister: { id: 'register-1', name: 'Caja 1', code: 'CAJA-01' },
  currency: 'MXN', total: '278.40', paymentMethod: 'CARD', createdAt: '2026-08-30T20:00:00.000Z',
};

// prettier-ignore
const suspended = {
  id: suspendedId, status: 'ACTIVE', context: saleDetail().context,
  author: { id: 'user-1', email: 'cajera@example.com' },
  customer: { id: 'customer-1', name: 'Ana López', identifier: 'ANA-01' },
  notes: 'Cliente vuelve en diez minutos',
  lines: [{
    product: { id: productId, name: product.name, sku: product.sku }, quantity: '1.000',
    lotId: null, serialNumbers: [], unitPriceSnapshot: '120.00', availableQuantitySnapshot: '10.000',
  }],
  completedSaleId: null, expiresAt: '2026-08-31T20:00:00.000Z',
  createdAt: '2026-08-30T20:00:00.000Z', cancelledAt: null, resumedAt: null,
};

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

interface MockState {
  voided: boolean;
  returns: ReturnType<typeof returned>[];
  suspendedSales: (typeof suspended)[];
  fiscal: ReturnType<typeof fiscalDocument> | null;
  writes: Array<{ path: string; key?: string; body?: unknown }>;
  suspendAttempts: number;
}

function returned(refundableAmount = '139.20') {
  return {
    id: returnId,
    saleId,
    exchangeSale: null,
    reason: 'Empaque abierto',
    settlementStatus: refundableAmount === '0.00' ? 'SETTLED' : 'PENDING',
    refundableAmount,
    loyaltyValueRestored: '0.00',
    totals: { subtotal: '120.00', tax: '19.20', total: '139.20' },
    returnedBy: { id: 'user-1', email: 'cajera@example.com' },
    createdAt: '2026-08-30T21:00:00.000Z',
    settlements:
      refundableAmount === '0.00'
        ? [
            {
              id: 'settlement-1',
              mode: 'REFUND',
              method: 'CARD',
              status: 'COMPLETED',
              currency: 'MXN',
              amount: '139.20',
              originalPayment: { id: paymentId, method: 'CARD' },
              provider: 'SIMULATOR',
              providerReference: 'REF-1',
              failureCode: null,
              processedBy: { id: 'user-1', email: 'cajera@example.com' },
              createdAt: '2026-08-30T21:01:00.000Z',
            },
          ]
        : [],
    lines: [
      {
        id: 'return-line-1',
        saleLineId: lineId,
        product,
        quantity: '1.000',
        condition: 'SELLABLE',
        totals: { subtotal: '120.00', tax: '19.20', total: '139.20' },
        serialNumbers: [],
      },
    ],
  };
}

function fiscalDocument() {
  return {
    id: 'fiscal-1',
    saleId,
    receiptNumber: 'V-2026-0042',
    documentType: 'INVOICE',
    provider: 'SIMULATOR',
    providerVersion: '1',
    providerReference: 'SIM-00042',
    scenario: 'SUCCESS',
    status: 'ACCEPTED',
    errorCode: null,
    artifacts: [{ kind: 'PDF', path: `/pos/sales/${saleId}/fiscal-document/artifacts/PDF` }],
    events: [{ status: 'ACCEPTED', occurredAt: '2026-08-30T20:05:00.000Z' }],
    createdAt: '2026-08-30T20:05:00.000Z',
    updatedAt: '2026-08-30T20:05:00.000Z',
  };
}

async function mockSales(page: Page, permissions: string[]) {
  const state: MockState = {
    voided: false,
    returns: [],
    suspendedSales: [suspended],
    fiscal: null,
    writes: [],
    suspendAttempts: 0,
  };
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    const method = request.method();
    const key = request.headers()['idempotency-key'];
    if (path === '/auth/sessions/current') return json(route, session(permissions));
    if (path === '/organization/branches') {
      return json(route, { data: [], meta: { apiVersion: '1' } });
    }
    if (path === '/pos/sales' && method === 'GET') {
      return json(route, {
        data: [{ ...summary, status: state.voided ? 'VOIDED' : 'COMPLETED' }],
        meta: { pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } },
      });
    }
    if (path === `/pos/sales/${saleId}/returns` && method === 'GET') {
      return json(route, { data: state.returns, meta: { apiVersion: '1' } });
    }
    if (path === `/pos/sales/${saleId}/returns` && method === 'POST') {
      state.writes.push({ path, key, body: request.postDataJSON() });
      state.returns = [returned()];
      return json(route, { data: state.returns[0], meta: { idempotentReplay: false } }, 201);
    }
    if (path.endsWith(`/returns/${returnId}/settlements`) && method === 'POST') {
      state.writes.push({ path, key, body: request.postDataJSON() });
      state.returns = [returned('0.00')];
      return json(route, { data: state.returns[0], meta: { idempotentReplay: false } }, 201);
    }
    if (path === `/pos/sales/${saleId}/fiscal-document` && method === 'GET') {
      return json(route, { data: state.fiscal, meta: { apiVersion: '1' } });
    }
    if (path === `/pos/sales/${saleId}/fiscal-document` && method === 'POST') {
      state.writes.push({ path, key, body: request.postDataJSON() });
      state.fiscal = fiscalDocument();
      return json(route, { data: state.fiscal, meta: { apiVersion: '1' } }, 201);
    }
    if (path === `/pos/sales/${saleId}/receipt/reprints` && method === 'POST') {
      state.writes.push({ path });
      return json(route, {
        data: {
          saleId,
          receiptNumber: 'V-2026-0042',
          documentType: 'NON_FISCAL_SALE_RECEIPT',
          fiscalNotice: 'COMPROBANTE NO FISCAL',
          merchant: { name: 'Café Central', legalName: null, countryCode: 'MX' },
          branchName: 'Centro',
          cashRegister: { name: 'Caja 1', code: 'CAJA-01' },
          sellerEmail: 'cajera@example.com',
          customer: { name: 'Ana López', identifier: 'ANA-01' },
          currency: 'MXN',
          taxRate: '0.1600',
          lines: [
            {
              lineNumber: 1,
              productName: product.name,
              productSku: product.sku,
              quantity: '2.000',
              unitPrice: '120.00',
              discountTotal: '0.00',
              total: '278.40',
            },
          ],
          payments: saleDetail().payments,
          totals: saleDetail().totals,
          issuedAt: '2026-08-30T20:00:00.000Z',
          saleStatus: 'COMPLETED',
          void: null,
        },
        meta: { apiVersion: '1' },
      });
    }
    if (path === `/pos/sales/${saleId}/void` && method === 'POST') {
      state.writes.push({ path, key, body: request.postDataJSON() });
      state.voided = true;
      return json(route, { data: saleDetail('VOIDED'), meta: { idempotentReplay: false } });
    }
    if (path === `/pos/sales/${saleId}` && method === 'GET') {
      return json(route, {
        data: saleDetail(state.voided ? 'VOIDED' : 'COMPLETED'),
        meta: { apiVersion: '1' },
      });
    }
    if (path === '/pos/suspended-sales' && method === 'GET') {
      return json(route, { data: state.suspendedSales, meta: { expirationHours: 24 } });
    }
    if (path === `/pos/suspended-sales/${suspendedId}/resume` && method === 'POST') {
      return json(route, {
        data: {
          suspendedSale: suspended,
          quote: quote().data,
          conflicts: [],
        },
        meta: { recalculatedAt: '2026-08-30T21:00:00.000Z' },
      });
    }
    if (path === '/products' && method === 'GET') {
      return json(route, {
        data: [product],
        meta: { pagination: { page: 1, pageSize: 24, total: 1, totalPages: 1 } },
      });
    }
    if (path === '/pos/register-shifts/current') {
      return json(route, {
        data: {
          id: 'shift-1',
          status: 'OPEN',
          branch: saleDetail().context.branch,
          cashRegister: saleDetail().context.cashRegister,
          openedBy: { id: 'user-1', email: 'cajera@example.com' },
          openingAmount: '500.00',
          currency: 'MXN',
          openedAt: '2026-08-30T18:00:00.000Z',
        },
        meta: { apiVersion: '1' },
      });
    }
    if (path === '/pos/cart/quote' && method === 'POST') return json(route, quote());
    if (path === '/pos/payment-options') {
      return json(route, { data: { methods: ['CASH'], nonCashProvider: 'SIMULATOR' } });
    }
    if (path === '/pos/sales' && method === 'POST') {
      state.writes.push({ path, key, body: request.postDataJSON() });
      return json(
        route,
        { data: { ...saleDetail(), credit: null }, meta: { idempotentReplay: false } },
        201,
      );
    }
    if (path === '/pos/suspended-sales' && method === 'POST') {
      state.suspendAttempts += 1;
      state.writes.push({ path, key, body: request.postDataJSON() });
      if (state.suspendAttempts === 1) return json(route, { code: 'TEMPORARY_FAILURE' }, 503);
      return json(route, { data: suspended, meta: { idempotentReplay: true } }, 201);
    }
    return json(route, { message: `Unhandled ${method} ${path}` }, 404);
  });
  return state;
}

function quote() {
  return {
    data: {
      context: saleDetail().context,
      currency: 'MXN',
      taxRate: '0.1600',
      lines: [
        {
          product,
          quantity: '1.000',
          note: null,
          availableQuantity: '10.000',
          unitPrice: '120.00',
          priceSource: 'BASE',
          priceOverrideReason: null,
          priceList: null,
          grossTotal: '120.00',
          subtotal: '120.00',
          tax: '19.20',
          total: '139.20',
        },
      ],
      totals: {
        gross: '120.00',
        lineDiscount: '0.00',
        promotionDiscount: '0.00',
        saleDiscount: '0.00',
        discount: '0.00',
        subtotal: '120.00',
        tax: '19.20',
        total: '139.20',
      },
    },
    meta: { apiVersion: '1', recalculatedAt: '2026-08-30T21:00:00.000Z' },
  };
}

const fullPermissions = ['SALES_MANAGE', 'SALE_REPRINT', 'SALES_VOID', 'SALES_RETURN'];

test('reissues the non-fiscal ticket and exposes the real fiscal adapter status', async ({
  page,
}, testInfo) => {
  const state = await mockSales(page, fullPermissions);
  await page.goto('./ventas/historial');
  await page.getByRole('button', { name: /V-2026-0042/ }).click();
  await page.getByRole('button', { name: 'Ticket' }).click();
  const receipt = page.getByRole('dialog', { name: 'V-2026-0042' });
  await expect(receipt.getByText('COMPROBANTE NO FISCAL')).toBeVisible();
  await receipt.getByRole('button', { name: 'Cerrar ticket' }).click();
  await page.getByRole('button', { name: 'Fiscalidad' }).click();
  await expect(page.getByText('SIMULATOR · v1')).toBeVisible();
  await expect(page.getByText('No productivo')).toBeVisible();
  await page.getByRole('button', { name: 'Emitir en simulador' }).click();
  await expect(page.getByText('Aceptado', { exact: true })).toBeVisible();
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelector('.workspace-content')?.scrollTo(0, 0);
  });
  await page.screenshot({
    path: testInfo.outputPath(`sales-fiscal-${testInfo.project.name}.png`),
    fullPage: true,
  });
  expect(state.writes.find(({ path }) => path.endsWith('/fiscal-document'))?.key).toMatch(/^web-/);
});

test('returns stock and refunds only against an available original payment', async ({ page }) => {
  const state = await mockSales(page, fullPermissions);
  await page.goto('./ventas/historial');
  await page.getByRole('button', { name: /V-2026-0042/ }).click();
  await page.getByRole('button', { name: 'Devolver' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nueva devolución' });
  await dialog.locator('input[type=number]').fill('1');
  await dialog.getByPlaceholder('Describe por qué se devuelve').fill('Empaque abierto');
  await dialog.getByRole('button', { name: 'Registrar devolución' }).click();
  await expect(page.getByText('Regresó a existencia')).toBeVisible();
  await page.getByRole('button', { name: 'Liquidar' }).click();
  const settlement = page.getByRole('dialog', { name: 'Resolver reembolso' });
  await expect(settlement.getByRole('option', { name: /CARD.*disponible/ })).toHaveCount(1);
  await expect(settlement.getByRole('option', { name: /Crédito en tienda/ })).toHaveCount(1);
  await expect(settlement.locator('select').nth(1)).toHaveValue(paymentId);
  await settlement.getByRole('button', { name: 'Registrar liquidación' }).click();
  await expect(page.getByText('Liquidación registrada contra un medio permitido.')).toBeVisible();
  const write = state.writes.find(({ path }) => path.endsWith('/settlements'));
  expect(write?.body).toEqual({ mode: 'REFUND', amount: '139.20', originalPaymentId: paymentId });
  expect(write?.key).toMatch(/^web-/);
});

test('voids the sale only after showing the stock and payment impact', async ({ page }) => {
  const state = await mockSales(page, fullPermissions);
  await page.goto('./ventas/historial');
  await page.getByRole('button', { name: /V-2026-0042/ }).click();
  await page.getByRole('button', { name: 'Anular' }).click();
  const dialog = page.getByRole('alertdialog', { name: /Anular V-2026-0042/ });
  await expect(dialog.getByText(/pagos y todos los movimientos de inventario/)).toBeVisible();
  await dialog.getByLabel('Motivo obligatorio').fill('Cobro duplicado');
  await dialog.getByRole('button', { name: 'Confirmar anulación' }).click();
  await expect(page.getByText('Venta anulada', { exact: true })).toBeVisible();
  const write = state.writes.find(({ path }) => path.endsWith('/void'));
  expect(write?.body).toEqual({ reason: 'Cobro duplicado' });
  expect(write?.key).toMatch(/^web-void:/);
});

test('suspends with one stable key and completes a resumed cart only once', async ({ page }) => {
  const state = await mockSales(page, fullPermissions);
  await page.goto('./ventas/pos');
  await page.getByRole('button', { name: `Agregar ${product.name}` }).click();
  await page.getByRole('button', { name: 'Suspender' }).click();
  await page.getByPlaceholder('Ej. Cliente regresa a las 16:00').fill('Cliente vuelve pronto');
  await page.getByRole('button', { name: 'Suspender venta' }).click();
  await expect(page).toHaveURL(/ventas\/historial\?view=suspended/);
  const suspensionWrites = state.writes.filter(({ path }) => path === '/pos/suspended-sales');
  expect(suspensionWrites).toHaveLength(2);
  expect(suspensionWrites[0].key).toBe(suspensionWrites[1].key);

  await page.getByRole('button', { name: 'Reanudar' }).click();
  await page.getByRole('button', { name: 'Abrir carrito en POS' }).click();
  await expect(page.getByText('Venta suspendida reanudada')).toBeVisible();
  await expect(page.locator('.cart-line').getByText(product.name, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Continuar al cobro/ }).click();
  await page.getByRole('button', { name: /Cobrar y completar venta/ }).click();
  const resumedWrite = state.writes.find(
    ({ path, body }) =>
      path === '/pos/sales' && (body as { suspendedSaleId?: string })?.suspendedSaleId,
  );
  expect(resumedWrite?.body).toMatchObject({
    suspendedSaleId: suspendedId,
    customerId: 'customer-1',
  });
});

test('hides mutation actions without permissions and remains usable on mobile', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSales(page, ['SALE_REPRINT']);
  await page.goto('./ventas/historial');
  await expect(page.getByRole('button', { name: 'Suspendidas' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Nueva venta' })).toHaveCount(0);
  await page.getByRole('button', { name: /V-2026-0042/ }).click();
  await expect(page.getByRole('button', { name: 'Ticket' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Devolver' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Anular' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cerrar detalle' })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath(`sales-readonly-${testInfo.project.name}.png`),
    fullPage: true,
  });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  expect(overflow).toBe(false);
});
