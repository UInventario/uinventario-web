import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

const product = {
  id: 'a9766220-d36e-44da-9ea1-6d88471073a1',
  name: 'Café molido 500 g',
  sku: 'CAFE-500',
  active: true,
  trackLots: true,
  baseUnit: 'UNIT',
  quantityPrecision: 0,
};

function session(
  permissions = ['INVENTORY_VIEW', 'INVENTORY_ADJUST', 'INVENTORY_VALUATION_MANAGE'],
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

const stockItem = {
  product,
  availableQuantity: '8.000',
  totalQuantity: '9.000',
  averageUnitCost: '137.1742',
  inventoryValue: '1234.5678',
  states: [
    { code: 'AVAILABLE', quantity: '8.000' },
    { code: 'DAMAGED', quantity: '1.000' },
  ],
  costing: {
    method: 'MOVING_AVERAGE',
    currency: 'MXN',
    quantity: '9.000',
    inventoryValue: '1234.5678',
    reconciled: true,
  },
  valuation: {
    quantity: '9.000',
    inventoryValue: '1234.5678',
    quantityReconciled: true,
    valueReconciled: true,
    reconciled: true,
  },
  lotTracking: {
    lotQuantity: '9.000',
    reconciled: true,
    currency: 'MXN',
    inventoryValue: '1234.5678',
  },
  fifoValuation: {
    quantity: '9.000',
    inventoryValue: '1222.2222',
    currency: 'MXN',
    reconciled: true,
  },
};

const warningRun = {
  id: '6d0ef55f-520e-432d-ad39-2dfeb89f7f7a',
  status: 'COMPLETED',
  overallStatus: 'WARNING',
  summary: { findings: 1, warnings: 1, critical: 0 },
  policy: { releaseBlocked: false, operationsBlocked: false },
  correlationId: 'correlation-warning',
  responsible: { id: 'admin-1', email: 'admin@example.com' },
  startedAt: '2026-08-30T20:00:00.000Z',
  finishedAt: '2026-08-30T20:00:02.000Z',
  findings: [
    {
      id: 'finding-1',
      code: 'FIFO_LAYER_MISMATCH',
      severity: 'WARNING',
      scopeType: 'VALUATION',
      product: { id: product.id, name: product.name, sku: product.sku },
      location: { id: 'location-1', name: 'Piso de venta', code: 'PV-01' },
      subjectReference: product.sku,
      expectedValue: '9.000',
      actualValue: '8.000',
      differenceValue: '-1.000',
      message: 'Las capas FIFO no coinciden con el saldo del producto.',
      recommendedAction: 'Revisar las capas y movimientos antes de activar FIFO.',
      blocksOperations: false,
    },
  ],
};

const healthyRun = {
  ...warningRun,
  id: '4fba96fe-bbde-4691-9f4e-c6ce33991513',
  overallStatus: 'HEALTHY',
  summary: { findings: 0, warnings: 0, critical: 0 },
  findings: [],
  finishedAt: '2026-08-30T20:10:02.000Z',
};

async function json(route: Route, data: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
}

async function mockValuation(page: Page, permissions?: string[]) {
  let policy = {
    method: 'MOVING_AVERAGE',
    version: 1,
    effectiveAt: '2026-08-20T12:00:00.000Z',
    migrationRule: 'INITIAL_DEFAULT',
  };
  let reconciliation = warningRun;
  let reconciliationKey: string | undefined;
  const writes: Array<{ path: string; body?: unknown; idempotencyKey?: string }> = [];

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    const method = request.method();
    const idempotencyKey = request.headers()['idempotency-key'];
    if (path === '/auth/sessions/current') return json(route, session(permissions));
    if (path === '/inventory/valuation-policy' && method === 'GET') {
      return json(route, { data: policy, meta: { apiVersion: '1' } });
    }
    if (path === '/inventory/valuation-policy/preview' && method === 'POST') {
      const body = request.postDataJSON() as { targetMethod: string };
      writes.push({ path, body });
      return json(route, {
        data: {
          current: policy,
          targetMethod: body.targetMethod,
          allowed: true,
          blockingReasons: [],
          strategy: 'USE_MAINTAINED_FIFO_LAYERS',
          productsToMigrate: 0,
          locationsToMigrate: 0,
          devicesToRebootstrap: 2,
          planFingerprint: 'a'.repeat(64),
        },
        meta: { apiVersion: '1' },
      });
    }
    if (path === '/inventory/valuation-policy/changes' && method === 'POST') {
      const body = request.postDataJSON() as { targetMethod: 'FIFO' };
      writes.push({ path, body, idempotencyKey });
      policy = {
        method: body.targetMethod,
        version: 2,
        effectiveAt: '2026-08-30T20:05:00.000Z',
        migrationRule: 'FORWARD_ONLY_CUTOVER',
      };
      return json(route, { data: policy, meta: { apiVersion: '1', replay: false } });
    }
    if (path === '/inventory/stock' && method === 'GET') {
      return json(route, {
        data: [
          {
            ...stockItem,
            costing: { ...stockItem.costing, method: policy.method },
          },
        ],
        meta: {
          apiVersion: '1',
          scope: {
            branch: { id: 'branch-1', name: 'Centro' },
            warehouse: { id: 'warehouse-1', name: 'Principal' },
          },
          valuation: {
            method: policy.method,
            policyVersion: policy.version,
            effectiveAt: policy.effectiveAt,
            currency: 'MXN',
            asOf: '2026-08-30T20:00:00.000Z',
          },
          pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        },
      });
    }
    if (path === `/inventory/products/${product.id}/fifo-layers` && method === 'GET') {
      return json(route, {
        data: [
          {
            id: 'layer-1',
            product: { id: product.id, name: product.name, sku: product.sku },
            location: { id: 'location-1', name: 'Piso de venta', code: 'PV-01' },
            originType: 'PURCHASE_RECEIPT',
            originalQuantity: '10.000',
            remainingQuantity: '8.000',
            unitCost: '135.8024',
            currency: 'MXN',
            inventoryValue: '1086.4192',
            acquiredAt: '2026-08-29T16:00:00.000Z',
            source: {
              movementId: 'movement-1',
              movementType: 'PURCHASE_RECEIPT',
              reference: 'REM-2026-100',
              layerId: null,
              purchaseReceiptLineId: 'receipt-line-1',
            },
          },
        ],
        meta: {
          apiVersion: '1',
          method: 'FIFO',
          cutover: {
            effectiveAt: '2026-08-20T12:00:00.000Z',
            migrationRule: 'OPENING_BALANCE_AT_MOVING_AVERAGE',
          },
          totalQuantity: '9.000',
          layerQuantity: '9.000',
          reconciled: true,
          currency: 'MXN',
          inventoryValue: '1222.2222',
        },
      });
    }
    if (path === '/inventory/movements' && method === 'GET') {
      return json(route, {
        data: [
          {
            id: 'movement-1',
            type: 'SALE',
            direction: 'OUT',
            quantityChange: '-1.000',
            resultingQuantity: '9.000',
            reason: 'Venta POS',
            reference: 'V-0001',
            createdAt: '2026-08-30T19:00:00.000Z',
            product: { id: product.id, name: product.name, sku: product.sku },
            location: {
              id: 'location-1',
              name: 'Piso de venta',
              code: 'PV-01',
              warehouse: { id: 'warehouse-1', name: 'Principal' },
            },
            responsible: { id: 'admin-1', email: 'admin@example.com' },
            valuation: {
              method: 'MOVING_AVERAGE',
              policyVersion: 1,
              effectiveAt: '2026-08-20T12:00:00.000Z',
              unitCost: '82.3456',
              valueChange: '-82.3456',
              resultingInventoryValue: '1234.5678',
              averageUnitCost: '137.1742',
            },
          },
        ],
        meta: {
          apiVersion: '1',
          pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        },
      });
    }
    if (path === '/inventory/reconciliations/latest' && method === 'GET') {
      return json(route, { data: reconciliation, meta: { apiVersion: '1' } });
    }
    if (path === '/inventory/reconciliations' && method === 'POST') {
      writes.push({ path, body: request.postDataJSON(), idempotencyKey });
      if (!reconciliationKey) {
        reconciliationKey = idempotencyKey;
        reconciliation = healthyRun;
        return json(
          route,
          { code: 'TEMPORARY_FAILURE', message: 'La confirmación de red fue interrumpida.' },
          503,
        );
      }
      if (idempotencyKey !== reconciliationKey) {
        return json(route, { code: 'IDEMPOTENCY_KEY_REUSED' }, 409);
      }
      return json(route, {
        data: reconciliation,
        meta: { apiVersion: '1', idempotentReplay: true },
      });
    }
    return json(route, { message: `Unhandled ${method} ${path}` }, 404);
  });

  return writes;
}

test('uses server valuation, changes policy and reconciles without duplicate runs', async ({
  page,
}, testInfo) => {
  const writes = await mockValuation(page);
  await page.goto('./inventario/valorizacion?q=cafe');
  const workspace = page.locator('ui-valuation-page');
  await expect(page.getByRole('heading', { name: 'Valorización y reconciliación' })).toBeVisible();
  await expect(workspace.getByText('MXN 1234.5678').first()).toBeVisible();
  await workspace.getByRole('button', { name: /Café molido 500 g/ }).click();
  await expect(page).toHaveURL(/product=a9766220/);
  await expect(workspace.getByText('Costo medio 137.1742')).toBeVisible();
  await workspace.getByRole('button', { name: 'Capas FIFO' }).click();
  await expect(workspace.getByText('MXN 1086.4192')).toBeVisible();
  await workspace.getByRole('button', { name: 'Historial' }).click();
  await expect(workspace.getByText('MXN -82.3456')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('valuation-history.png') });

  if (testInfo.project.name === 'mobile-chromium') {
    await workspace.getByRole('button', { name: 'Volver a productos' }).click();
    await expect(page.locator('ui-valuation-stock-list')).toBeVisible();
  }

  await workspace.getByRole('button', { name: 'Cambiar política' }).click();
  const policyDialog = page.getByRole('dialog');
  await policyDialog.getByLabel('Método objetivo').selectOption('FIFO');
  await policyDialog.getByRole('button', { name: 'Prevalidar impacto' }).click();
  await expect(policyDialog.getByText('Cambio permitido')).toBeVisible();
  await expect(policyDialog.getByText('2', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('valuation-policy-plan.png') });
  await policyDialog.getByRole('checkbox').check();
  await policyDialog.getByRole('button', { name: 'Aplicar cambio' }).click();
  await expect(
    page.getByText('Política actualizada. La historia previa permanece sin reescritura.'),
  ).toBeVisible();

  await workspace.getByRole('button', { name: /Reconciliación/ }).click();
  await expect(workspace.getByText('FIFO_LAYER_MISMATCH')).toBeVisible();
  await expect(
    workspace.getByText('Revisar las capas y movimientos antes de activar FIFO.'),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('valuation-reconciliation-warning.png') });
  await workspace.getByRole('button', { name: 'Reconciliar' }).click();
  await expect(page.getByText('Reconciliación completa: inventario saludable.')).toBeVisible();
  await expect(workspace.getByText('Sin desbalances')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('valuation-reconciliation-healthy.png') });

  const policyWrites = writes.filter((write) => write.path.endsWith('/changes'));
  const reconciliationWrites = writes.filter(
    (write) => write.path === '/inventory/reconciliations',
  );
  expect(policyWrites).toHaveLength(1);
  expect(policyWrites[0].idempotencyKey).toMatch(/^web-/);
  expect(reconciliationWrites).toHaveLength(2);
  expect(new Set(reconciliationWrites.map((write) => write.idempotencyKey)).size).toBe(1);
  expect(reconciliationWrites[0].idempotencyKey).toMatch(/^web-/);
});

test('keeps valuation read-only without management permissions', async ({ page }, testInfo) => {
  await mockValuation(page, ['INVENTORY_VIEW']);
  await page.goto('./inventario/valorizacion?view=reconciliation');
  const workspace = page.locator('ui-valuation-page');
  await expect(workspace.getByText('FIFO_LAYER_MISMATCH')).toBeVisible();
  await expect(workspace.getByRole('button', { name: 'Cambiar política' })).toBeHidden();
  await expect(workspace.getByRole('button', { name: 'Reconciliar' })).toBeHidden();
  await page.locator('ui-ribbon').getByRole('button', { name: 'Valorización' }).click();
  await expect(page).toHaveURL(/inventario\/valorizacion/);
  await expect(page).not.toHaveURL(/view=reconciliation/);
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.documentWidth).toBe(dimensions.viewportWidth);
  await page.screenshot({ path: testInfo.outputPath('valuation-read-only.png') });
});
