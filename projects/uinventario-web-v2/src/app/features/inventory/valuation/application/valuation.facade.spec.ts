import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ValuationGateway } from '../domain/valuation.gateway';
import {
  ValuationMigrationPlan,
  ValuationPolicy,
  ValuationStockPage,
} from '../domain/valuation.models';
import { ValuationFacade } from './valuation.facade';

describe('ValuationFacade', () => {
  const policy: ValuationPolicy = {
    method: 'MOVING_AVERAGE',
    version: 3,
    effectiveAt: '2026-08-30T20:00:00.000Z',
    migrationRule: 'FORWARD_ONLY_CUTOVER',
  };
  const plan = {
    current: policy,
    targetMethod: 'FIFO',
    allowed: true,
    blockingReasons: [],
    strategy: 'USE_MAINTAINED_FIFO_LAYERS',
    productsToMigrate: 0,
    locationsToMigrate: 0,
    devicesToRebootstrap: 2,
    planFingerprint: 'a'.repeat(64),
  } as ValuationMigrationPlan;
  const stock = {
    items: [{ costing: { inventoryValue: '1234.5678' } }],
  } as unknown as ValuationStockPage;
  const gateway = {
    policy: vi.fn(() => of(policy)),
    latestReconciliation: vi.fn(() => of(null)),
    stock: vi.fn(() => of(stock)),
    fifoLayers: vi.fn(() => of({ items: [], meta: {} })),
    movements: vi.fn(() => of({ items: [], pagination: {} })),
    previewPolicy: vi.fn(() => of(plan)),
    changePolicy: vi.fn(() => of({ ...policy, method: 'FIFO' })),
    runReconciliation: vi.fn(() => of({ overallStatus: 'HEALTHY' })),
  };
  let facade: ValuationFacade;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [ValuationFacade, { provide: ValuationGateway, useValue: gateway }],
    });
    facade = TestBed.inject(ValuationFacade);
  });

  it('composes server policy and reconciliation without deriving monetary totals', () => {
    facade
      .context()
      .subscribe((context) => expect(context).toEqual({ policy, reconciliation: null }));
    facade.stock({ page: 1, pageSize: 20 }).subscribe((result) => {
      expect(result).toBe(stock);
      expect(result.items[0].costing.inventoryValue).toBe('1234.5678');
    });
  });

  it('passes the approved plan and stable idempotency keys to control operations', () => {
    facade.changePolicy(plan, 'policy-key').subscribe();
    facade.runReconciliation('reconciliation-key').subscribe();
    expect(gateway.changePolicy).toHaveBeenCalledWith(plan, 'policy-key');
    expect(gateway.runReconciliation).toHaveBeenCalledWith('reconciliation-key');
  });
});
