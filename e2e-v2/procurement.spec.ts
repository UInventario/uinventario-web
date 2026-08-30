import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

const supplier = {
  id: '57b74392-2a7d-4e65-88d3-5b40d7f4f027',
  legalName: 'Distribuidora Norte SA',
  tradeName: 'Norte',
};

const supplierProduct = {
  id: 'be12eca2-b484-4f60-86d1-7068aa781ac5',
  supplierCode: 'PROV-CAFE-01',
  minimumQuantity: '2',
  product: {
    id: 'a9766220-d36e-44da-9ea1-6d88471073a1',
    name: 'Café molido 500 g',
    sku: 'CAFE-500',
    quantityPrecision: 0,
  },
  prices: [{ currency: 'MXN', unitCost: '85.00', validFrom: '2026-08-30' }],
};

function session(
  permissions = ['PURCHASE_ORDERS_MANAGE', 'PURCHASE_ORDERS_APPROVE', 'PURCHASE_RECEIPTS_OVERAGE'],
) {
  return {
    data: {
      user: { id: 'admin-1', email: 'admin@example.com', roles: ['ADMIN'], permissions },
      tenant: { id: 'tenant-1', name: 'Tienda Central' },
      context: {
        branch: { id: 'branch-1', name: 'Centro' },
        warehouse: { id: 'warehouse-1', name: 'Principal' },
        cashRegister: null,
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

async function mockProcurement(page: Page, permissions?: string[]) {
  let orders: Array<Record<string, unknown>> = [];
  let receiptIdempotencyKey: string | undefined;
  let receiptReplay: Record<string, unknown> | undefined;
  const writes: Array<{
    path: string;
    method: string;
    body?: unknown;
    idempotencyKey?: string;
  }> = [];

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    const method = request.method();
    if (path === '/auth/sessions/current') return json(route, session(permissions));
    if (path === '/suppliers') {
      return json(route, {
        data: [supplier],
        meta: { apiVersion: '1', pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 } },
      });
    }
    if (path === '/supplier-products') {
      return json(route, {
        data: [supplierProduct],
        meta: { apiVersion: '1', pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 } },
      });
    }
    if (path === '/inventory/locations') {
      return json(route, {
        data: [{ id: 'location-1', name: 'Piso de venta', code: 'PV-01' }],
        meta: { apiVersion: '1' },
      });
    }
    if (path === '/purchase-orders' && method === 'GET') {
      return json(route, {
        data: orders,
        meta: {
          apiVersion: '1',
          pagination: { page: 1, pageSize: 20, total: orders.length, totalPages: 1 },
        },
      });
    }
    if (path === '/purchase-orders' && method === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      const line = (body['lines'] as Array<Record<string, unknown>>)[0];
      const created = {
        id: '4fba96fe-bbde-4691-9f4e-c6ce33991513',
        folio: 'OC-2026-0001',
        supplier: { id: supplier.id, name: supplier.legalName },
        currency: body['currency'],
        status: 'DRAFT',
        notes: body['notes'] ?? null,
        subtotal: '850.00',
        total: '850.00',
        version: 1,
        approvedAt: null,
        sentAt: null,
        cancelledAt: null,
        cancellationReason: null,
        transitions: [],
        receipts: [],
        returns: [],
        lines: [
          {
            id: '11b21d11-2ab8-4fca-9eeb-24a3c3077a1c',
            supplierProductId: supplierProduct.id,
            productId: supplierProduct.product.id,
            productName: supplierProduct.product.name,
            productSku: supplierProduct.product.sku,
            baseUnit: 'UNIT',
            quantityPrecision: 0,
            minimumQuantity: '1',
            supplierCode: supplierProduct.supplierCode,
            quantity: String(line['quantity']),
            receivedQuantity: '0',
            remainingQuantity: String(line['quantity']),
            overageQuantity: '0',
            unitCost: String(line['unitCost']),
            subtotal: '850.00',
            notes: line['notes'] ?? null,
          },
        ],
        createdAt: '2026-08-30T20:00:00.000Z',
        updatedAt: '2026-08-30T20:00:00.000Z',
      };
      orders = [created];
      writes.push({ path, method, body });
      return json(route, { data: created, meta: { apiVersion: '1' } }, 201);
    }
    const match = path.match(
      /^\/purchase-orders\/([^/]+)(?:\/(approve|send|cancel|receipts|returns))?$/,
    );
    if (!match) return json(route, { message: `Unhandled ${method} ${path}` }, 404);
    const action = match[2];
    if (!action && method === 'GET') {
      return json(route, { data: orders[0], meta: { apiVersion: '1' } });
    }
    if (!action && method === 'PATCH') {
      const body = request.postDataJSON() as Record<string, unknown>;
      const current = orders[0];
      const quantity = String((body['lines'] as Array<Record<string, unknown>>)[0]['quantity']);
      orders = [
        {
          ...current,
          notes: body['notes'] ?? null,
          version: 2,
          subtotal: '680.00',
          total: '680.00',
          lines: (current['lines'] as Array<Record<string, unknown>>).map((line) => ({
            ...line,
            quantity,
            remainingQuantity: quantity,
            subtotal: '680.00',
          })),
        },
      ];
      writes.push({ path, method, body });
      return json(route, { data: orders[0], meta: { apiVersion: '1' } });
    }
    const idempotencyKey = request.headers()['idempotency-key'];
    if (action === 'approve' || action === 'send') {
      const body = request.postDataJSON() as Record<string, unknown>;
      const current = orders[0];
      const status = action === 'approve' ? 'APPROVED' : 'SENT';
      orders = [
        {
          ...current,
          status,
          version: Number(current['version']) + 1,
          transitions: [
            ...(current['transitions'] as Array<Record<string, unknown>>),
            {
              id: `transition-${action}`,
              fromStatus: current['status'],
              toStatus: status,
              reason: body['reason'] ?? null,
              delivery:
                action === 'send' ? { mode: 'SIMULATED', recipient: 'compras@example.com' } : null,
              createdAt: '2026-08-30T20:05:00.000Z',
            },
          ],
        },
      ];
      writes.push({ path, method, body, idempotencyKey });
      return json(route, { data: orders[0], meta: { apiVersion: '1' } });
    }
    if (action === 'receipts') {
      const body = request.postDataJSON() as Record<string, unknown>;
      writes.push({ path, method, body, idempotencyKey });
      if (receiptIdempotencyKey) {
        if (idempotencyKey !== receiptIdempotencyKey) {
          return json(
            route,
            {
              code: 'IDEMPOTENCY_KEY_REUSED',
              message: 'La recepción ya fue procesada con otra clave.',
            },
            409,
          );
        }
        return json(route, {
          data: receiptReplay,
          meta: { apiVersion: '1', idempotentReplay: true, receiptId: 'receipt-1' },
        });
      }
      receiptIdempotencyKey = idempotencyKey;
      const current = orders[0];
      const receiptInput = (body['lines'] as Array<Record<string, unknown>>)[0];
      const receivedQuantity = String(receiptInput['receivedQuantity']);
      const receipt = {
        id: 'receipt-1',
        documentReference: body['documentReference'],
        location: { id: 'location-1', name: 'Piso de venta', code: 'PV-01' },
        responsible: { id: 'admin-1', email: 'admin@example.com' },
        overageReason: body['overageReason'] ?? null,
        lines: [
          {
            id: 'receipt-line-1',
            purchaseOrderLineId: current['lines'][0]['id'],
            receivedQuantity,
            lotCode: receiptInput['lotCode'] ?? null,
            manufacturedOn: null,
            expiresOn: null,
            overageQuantity: '1',
            unitCost: '85.00',
            totalCost: '765.00',
            previousCatalogCost: '85.00',
            resultingCatalogCost: '85.00',
            returnedQuantity: '0',
            returnableQuantity: receivedQuantity,
          },
        ],
        createdAt: '2026-08-30T20:10:00.000Z',
      };
      orders = [
        {
          ...current,
          status: 'RECEIVED',
          version: Number(current['version']) + 1,
          receipts: [receipt],
          lines: (current['lines'] as Array<Record<string, unknown>>).map((line) => ({
            ...line,
            receivedQuantity,
            remainingQuantity: '0',
            overageQuantity: '1',
          })),
        },
      ];
      receiptReplay = orders[0];
      return json(
        route,
        {
          code: 'TEMPORARY_FAILURE',
          message: 'La confirmación de red fue interrumpida.',
        },
        503,
      );
    }
    if (action === 'returns') {
      const body = request.postDataJSON() as Record<string, unknown>;
      const current = orders[0];
      const returnInput = (body['lines'] as Array<Record<string, unknown>>)[0];
      const returnedQuantity = String(returnInput['returnedQuantity']);
      const purchaseReturn = {
        id: 'return-1',
        purchaseReceiptId: 'receipt-1',
        documentReference: body['documentReference'],
        reason: body['reason'],
        status: 'CREDIT_PENDING',
        expectedCreditTotal: '170.00',
        creditDocumentReference: null,
        location: { id: 'location-1', name: 'Piso de venta', code: 'PV-01' },
        responsible: { id: 'admin-1', email: 'admin@example.com' },
        lines: [
          {
            id: 'return-line-1',
            purchaseReceiptLineId: 'receipt-line-1',
            productId: supplierProduct.product.id,
            returnedQuantity,
            unitCost: '85.00',
            totalCost: '170.00',
          },
        ],
        createdAt: '2026-08-30T20:15:00.000Z',
      };
      orders = [
        {
          ...current,
          returns: [purchaseReturn],
          receipts: (current['receipts'] as Array<Record<string, unknown>>).map((receipt) => ({
            ...receipt,
            lines: (receipt['lines'] as Array<Record<string, unknown>>).map((line) => ({
              ...line,
              returnedQuantity,
              returnableQuantity: String(
                Number(line['returnableQuantity']) - Number(returnedQuantity),
              ),
            })),
          })),
        },
      ];
      writes.push({ path, method, body, idempotencyKey });
      return json(
        route,
        { data: orders[0], meta: { apiVersion: '1', returnId: purchaseReturn.id } },
        201,
      );
    }
    return json(route, { message: `Unhandled ${method} ${path}` }, 404);
  });

  return writes;
}

test('runs the purchase order, approval, receipt discrepancy and supplier return cycle', async ({
  page,
}, testInfo) => {
  const writes = await mockProcurement(page);
  await page.goto('./compras/ordenes?q=norte');
  await expect(page.getByRole('heading', { name: 'Órdenes de compra' })).toBeVisible();
  const procurement = page.locator('ui-procurement-page');
  await procurement.getByRole('button', { name: 'Nueva orden' }).click();
  const editor = page.getByRole('dialog');
  await editor.getByLabel('Proveedor', { exact: true }).selectOption(supplier.id);
  await editor.getByLabel('Producto del proveedor').selectOption(supplierProduct.id);
  await editor.getByLabel('Cantidad').fill('10');
  await page.screenshot({ path: testInfo.outputPath('procurement-order-editor.png') });
  await editor.getByRole('button', { name: 'Crear borrador' }).click();
  await expect(page.getByText('Borrador creado.')).toBeVisible();
  await expect(page).toHaveURL(/q=norte/);
  await expect(page).toHaveURL(/order=4fba96fe/);

  await page.getByRole('button', { name: 'Editar' }).click();
  await page.getByLabel('Cantidad').fill('8');
  await page.getByLabel('Notas de la orden').fill('Entrega en horario de recepción');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Borrador actualizado.')).toBeVisible();

  await page.getByRole('button', { name: 'Aprobar' }).click();
  await page.getByLabel('Nota de aprobación (opcional)').fill('Presupuesto autorizado');
  await page.getByRole('button', { name: 'Aprobar orden' }).click();
  await expect(page.getByText('Orden aprobada.')).toBeVisible();
  await page.getByRole('button', { name: 'Enviar' }).click();
  await page.getByRole('button', { name: 'Enviar orden' }).click();
  await expect(page.getByText('Envío de la orden registrado.')).toBeVisible();

  await procurement.getByRole('button', { name: 'Recibir' }).click();
  const receipt = page.getByRole('dialog');
  await receipt.getByLabel('Documento o remisión').fill('REM-2026-100');
  await receipt.getByLabel('Cantidad recibida').fill('9');
  await receipt
    .getByLabel('Explicación de sobrante')
    .fill('Proveedor incluyó una unidad adicional');
  await page.screenshot({ path: testInfo.outputPath('procurement-receipt-dialog.png') });
  await receipt.getByRole('button', { name: 'Confirmar recepción' }).click();
  await expect(page.getByText('Recepción registrada e inventario actualizado.')).toBeVisible();

  await page.getByRole('button', { name: 'Recepciones y devoluciones' }).click();
  const discrepancy = page.getByText('Sobrante explicado: Proveedor incluyó una unidad adicional');
  await expect(discrepancy).toBeVisible();
  await discrepancy.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('procurement-receipt.png') });
  await page.getByRole('button', { name: 'Devolver' }).click();
  const purchaseReturn = page.getByRole('dialog');
  await purchaseReturn.getByLabel('Documento de devolución').fill('DEV-2026-010');
  await purchaseReturn.getByLabel('Motivo').fill('Empaque dañado');
  await purchaseReturn.getByLabel('Cantidad a devolver').fill('2');
  await page.screenshot({ path: testInfo.outputPath('procurement-return-dialog.png') });
  await purchaseReturn.getByRole('button', { name: 'Confirmar devolución' }).click();
  await expect(page.getByText('Devolución registrada sin duplicar movimientos.')).toBeVisible();
  const credit = page.getByText('Crédito pendiente');
  await expect(credit).toBeVisible();
  await credit.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('procurement-return.png') });

  const denseDimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(denseDimensions.documentWidth).toBe(denseDimensions.viewportWidth);
  if (testInfo.project.name === 'mobile-chromium') {
    await page.getByRole('button', { name: 'Volver a órdenes' }).click();
    await expect(page.locator('ui-order-list')).toBeVisible();
    await expect(page).not.toHaveURL(/order=/);
  }

  const receiptWrites = writes.filter((write) => write.path.endsWith('/receipts'));
  const returnWrites = writes.filter((write) => write.path.endsWith('/returns'));
  expect(receiptWrites).toHaveLength(2);
  expect(returnWrites).toHaveLength(1);
  expect(receiptWrites[0].idempotencyKey).toMatch(/^web-/);
  expect(new Set(receiptWrites.map((write) => write.idempotencyKey)).size).toBe(1);
  expect(returnWrites[0].idempotencyKey).toMatch(/^web-/);
  expect(writes.filter((write) => write.path.endsWith('/approve'))[0].idempotencyKey).toMatch(
    /^web-/,
  );
});

test('keeps approval-only access read-only and mobile navigation focused', async ({
  page,
}, testInfo) => {
  await mockProcurement(page, ['PURCHASE_ORDERS_APPROVE']);
  await page.goto('./compras/ordenes');
  await expect(page.getByRole('heading', { name: 'Órdenes de compra' })).toBeVisible();
  await expect(
    page.locator('ui-procurement-page').getByRole('button', { name: 'Nueva orden' }),
  ).toBeHidden();
  await expect(
    page.locator('ui-ribbon').getByRole('button', { name: 'Nueva orden' }),
  ).toBeDisabled();
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.documentWidth).toBe(dimensions.viewportWidth);
  await page.screenshot({ path: testInfo.outputPath('procurement-empty.png') });
});
