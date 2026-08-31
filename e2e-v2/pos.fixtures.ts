import type { Page, Route } from '@playwright/test';

export const product = (overrides: Record<string, unknown> = {}) => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Café molido',
  sku: 'CAF-001',
  barcode: '750100000001',
  withoutCode: false,
  stockBehavior: 'TRACKED',
  taxBehavior: 'STANDARD',
  baseUnit: 'KILOGRAM',
  quantityPrecision: 3,
  quantityRounding: 'HALF_UP',
  minimumQuantity: '0.250',
  trackLots: false,
  trackSerials: false,
  price: '120.00',
  active: true,
  sellable: true,
  ...overrides,
});

const service = product({
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Instalación básica',
  sku: 'AUTO-00042',
  barcode: null,
  withoutCode: true,
  stockBehavior: 'UNTRACKED',
  baseUnit: 'UNIT',
  quantityPrecision: 0,
  minimumQuantity: '1.000',
  price: '350.00',
});

export const trackedProduct = product({
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Equipo serializado',
  sku: 'SER-001',
  barcode: '750100000003',
  baseUnit: 'UNIT',
  quantityPrecision: 0,
  minimumQuantity: '1.000',
  trackLots: true,
  trackSerials: true,
  allowExpiredStockOverride: false,
  price: '500.00',
});

const branch = {
  id: 'branch-1',
  name: 'Centro',
  timezone: 'America/Mexico_City',
  active: true,
  warehouses: [{ id: 'warehouse-1', name: 'Principal', active: true, locations: [] }],
  cashRegisters: [
    { id: 'register-1', name: 'Caja 1', code: 'CAJA-01' },
    { id: 'register-2', name: 'Caja 2', code: 'CAJA-02' },
  ],
};

function session(registerId: string, permissions: string[]) {
  const register = branch.cashRegisters.find(({ id }) => id === registerId)!;
  return {
    data: {
      user: { id: 'user-1', email: 'cashier@example.com', roles: ['CASHIER'], permissions },
      tenant: { id: 'tenant-1', name: 'Tienda Central' },
      context: {
        branch: { id: branch.id, name: branch.name },
        warehouse: { id: 'warehouse-1', name: 'Principal' },
        cashRegister: register,
      },
      nextStep: 'APPLICATION',
    },
    meta: { apiVersion: '1', sessionExpiresAt: new Date(Date.now() + 3_600_000).toISOString() },
  };
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

function quoteFor(lines: Array<Record<string, unknown>>, request: Record<string, unknown> = {}) {
  const quoted = lines.map((line) => {
    const source =
      [product(), service, trackedProduct].find(({ id }) => id === line['productId']) ?? product();
    const quantity = String(line['quantity']);
    const contextual = Boolean(request['customerId']) && source.id === product().id;
    const price = String(line['manualUnitPrice'] ?? (contextual ? '100.00' : source.price));
    const gross = Number(quantity) * Number(price);
    const requestedDiscount = line['discount'] as
      { type: 'PERCENT' | 'AMOUNT'; value: string; reason: string } | undefined;
    const lineDiscount = requestedDiscount
      ? requestedDiscount.type === 'PERCENT'
        ? (gross * Number(requestedDiscount.value)) / 100
        : Number(requestedDiscount.value)
      : 0;
    const promotionAmount = contextual ? Math.min(2.5, gross - lineDiscount) : 0;
    const total = Math.max(0, gross - lineDiscount - promotionAmount).toFixed(2);
    return {
      product: source,
      quantity,
      note: line['note'] ?? null,
      lotId: line['lotId'] ?? null,
      expiredLotOverrideReason: line['expiredLotOverrideReason'] ?? null,
      serialNumbers: line['serialNumbers'] ?? [],
      availableQuantity: source.stockBehavior === 'UNTRACKED' ? '0.000' : '20.000',
      unitPrice: price,
      priceSource: line['manualUnitPrice'] ? 'MANUAL' : contextual ? 'PRICE_LIST' : 'BASE',
      priceOverrideReason: line['priceOverrideReason'] ?? null,
      priceList: contextual ? { id: 'list-1', name: 'Preferente Centro' } : null,
      grossTotal: gross.toFixed(2),
      discount: {
        line: requestedDiscount ? { ...requestedDiscount, amount: lineDiscount.toFixed(2) } : null,
        sale: null,
        total: lineDiscount.toFixed(2),
      },
      promotions: contextual
        ? [
            {
              promotion: {
                id: 'promotion-1',
                name: 'Cliente frecuente',
                type: 'SECOND_UNIT_PERCENT',
                priority: 10,
              },
              amount: promotionAmount.toFixed(2),
              explanation: 'Promoción Cliente frecuente aplicada por contexto',
              ruleSnapshot: { customerId: request['customerId'] },
            },
          ]
        : [],
      subtotal: total,
      tax: '0.00',
      total,
    };
  });
  const gross = quoted.reduce((sum, line) => sum + Number(line.grossTotal), 0);
  const lineDiscount = quoted.reduce((sum, line) => sum + Number(line.discount.total), 0);
  const promotionDiscount = quoted.reduce(
    (sum, line) =>
      sum + line.promotions.reduce((value, promotion) => value + Number(promotion.amount), 0),
    0,
  );
  const requestedSaleDiscount = request['discount'] as
    { type: 'PERCENT' | 'AMOUNT'; value: string; reason: string } | undefined;
  const saleBase = gross - lineDiscount - promotionDiscount;
  const saleDiscount = requestedSaleDiscount
    ? requestedSaleDiscount.type === 'PERCENT'
      ? (saleBase * Number(requestedSaleDiscount.value)) / 100
      : Number(requestedSaleDiscount.value)
    : 0;
  const total = Math.max(0, saleBase - saleDiscount).toFixed(2);
  const pointsRedeemed = Number(request['loyaltyPointsToRedeem'] ?? 0);
  const redemptionValue = pointsRedeemed ? pointsRedeemed / 10 : 0;
  return {
    data: {
      context: {
        branch: { id: branch.id, name: branch.name },
        warehouse: { id: 'warehouse-1', name: 'Principal' },
        cashRegister: branch.cashRegisters[0],
      },
      currency: 'MXN',
      taxRate: '0.0000',
      discount: requestedSaleDiscount
        ? { ...requestedSaleDiscount, amount: saleDiscount.toFixed(2) }
        : null,
      loyalty: request['customerId']
        ? {
            rule: {
              id: 'rule-1',
              version: 2,
              active: true,
              earnAmount: '100.00',
              earnPoints: 5,
              redeemPoints: 100,
              redeemAmount: '10.00',
              expirationDays: null,
              createdAt: '2026-08-30T00:00:00.000Z',
            },
            balanceBefore: 300,
            pointsRedeemed,
            redemptionValue: redemptionValue.toFixed(2),
            pointsEarned: 5,
            balanceAfter: 305 - pointsRedeemed,
          }
        : null,
      lines: quoted,
      totals: {
        gross: gross.toFixed(2),
        lineDiscount: lineDiscount.toFixed(2),
        promotionDiscount: promotionDiscount.toFixed(2),
        saleDiscount: saleDiscount.toFixed(2),
        discount: (lineDiscount + promotionDiscount + saleDiscount).toFixed(2),
        subtotal: total,
        tax: '0.00',
        total,
        ...(pointsRedeemed
          ? { payable: Math.max(0, Number(total) - redemptionValue).toFixed(2) }
          : {}),
      },
    },
    meta: { apiVersion: '1', recalculatedAt: '2026-08-30T17:00:00.000Z' },
  };
}

export interface MockOptions {
  permissions?: string[];
  register?: { current: string };
  quoteWrites?: Array<Array<Record<string, unknown>>>;
  quoteRequests?: Array<Record<string, unknown>>;
}

export async function mockPos(page: Page, options: MockOptions = {}): Promise<void> {
  const permissions = options.permissions ?? [
    'SALES_MANAGE',
    'SALES_PRICE_OVERRIDE',
    'SALES_DISCOUNT',
  ];
  const register = options.register ?? { current: 'register-1' };
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');
    if (path === '/auth/sessions/current') {
      await json(route, session(register.current, permissions));
      return;
    }
    if (path === '/organization/branches') {
      await json(route, { data: [branch], meta: { apiVersion: '1' } });
      return;
    }
    if (path === '/pos/register-shifts/current') {
      await json(route, {
        data: {
          id: 'shift-1',
          status: 'OPEN',
          branch: { id: branch.id, name: branch.name },
          cashRegister: branch.cashRegisters.find(({ id }) => id === register.current),
          openedBy: { id: 'user-1', email: 'cashier@example.com' },
          openingAmount: '1000.00',
          currency: 'MXN',
          openedAt: '2026-08-30T15:00:00.000Z',
        },
        meta: { apiVersion: '1' },
      });
      return;
    }
    if (path === '/products' && route.request().method() === 'GET') {
      const query = url.searchParams.get('q')?.toLocaleLowerCase() ?? '';
      if (query === 'slow') await new Promise((resolve) => setTimeout(resolve, 450));
      const values = [product(), service, trackedProduct].filter(
        (item) =>
          !query ||
          item.name.toLocaleLowerCase().includes(query) ||
          item.sku.toLocaleLowerCase().includes(query),
      );
      await json(route, {
        data: values,
        meta: {
          apiVersion: '1',
          pagination: { page: 1, pageSize: 24, total: values.length, totalPages: 1 },
        },
      });
      return;
    }
    if (path === `/inventory/products/${trackedProduct.id}/lots`) {
      await json(route, {
        data: [
          {
            id: 'lot-1',
            code: 'LOT-ACTIVO',
            quantity: '2.000',
            expiresOn: '2027-08-31',
            expirationStatus: 'ACTIVE',
            daysUntilExpiration: 365,
            balances: [
              {
                location: { id: 'location-1', name: 'Piso de venta', code: 'PISO' },
                quantity: '2.000',
              },
            ],
          },
        ],
        meta: { apiVersion: '1', tracked: true },
      });
      return;
    }
    if (path === `/inventory/products/${trackedProduct.id}/serials`) {
      await json(route, {
        data: [
          {
            id: 'serial-1',
            serialNumber: 'SN-0001',
            status: 'AVAILABLE',
            currentLocation: { id: 'location-1', name: 'Piso de venta', code: 'PISO' },
          },
        ],
        meta: { apiVersion: '1', tracked: true },
      });
      return;
    }
    if (path === '/products/resolve-code') {
      const code = url.searchParams.get('code');
      if (code === product().barcode || code === product().sku) {
        await json(route, { data: product(), meta: { apiVersion: '1' } });
      } else {
        await json(route, { code: 'PRODUCT_CODE_NOT_FOUND', message: 'Not found' }, 404);
      }
      return;
    }
    if (path === '/customers' && route.request().method() === 'GET') {
      await json(route, {
        data: [
          {
            id: 'customer-1',
            name: 'Cliente preferente',
            identifier: 'CUST-01',
            email: 'cliente@example.com',
            phone: null,
            active: true,
            privacyStatus: 'ACTIVE',
            credit: null,
          },
        ],
        meta: { apiVersion: '1', pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 } },
      });
      return;
    }
    if (path === '/loyalty/customers/customer-1') {
      await json(route, {
        data: {
          customer: { id: 'customer-1', name: 'Cliente preferente' },
          rule: {
            id: 'rule-1',
            version: 2,
            active: true,
            earnAmount: '100.00',
            earnPoints: 5,
            redeemPoints: 100,
            redeemAmount: '10.00',
            expirationDays: null,
            createdAt: '2026-08-30T00:00:00.000Z',
          },
          balance: 300,
          entries: [],
        },
        meta: { apiVersion: '1' },
      });
      return;
    }
    if (path === '/pos/cart/quote' && route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as {
        lines: Array<Record<string, unknown>>;
        [key: string]: unknown;
      };
      options.quoteWrites?.push(body.lines);
      options.quoteRequests?.push(body);
      await json(route, quoteFor(body.lines, body));
      return;
    }
    throw new Error(`Request no simulada: ${route.request().method()} ${path}`);
  });
}
