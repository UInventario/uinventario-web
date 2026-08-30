import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SessionApiService } from '../auth/session-api.service';
import { OfflineInventoryPanelComponent } from './offline-inventory-panel.component';
import { OfflineStoreService } from './offline-store.service';

describe('OfflineInventoryPanelComponent', () => {
  let fixture: ComponentFixture<OfflineInventoryPanelComponent>;
  const store = {
    deviceId: vi.fn().mockResolvedValue('10000000-0000-4000-8000-000000000001'),
    entities: vi.fn(),
    queue: vi.fn(),
    freshness: vi.fn(),
    assertAction: vi.fn(),
  };
  const session = {
    tenant: { id: 'tenant-1' },
    user: {
      id: 'user-1',
      permissions: ['INVENTORY_COUNT', 'INVENTORY_ADJUST'],
    },
    context: {
      branch: { id: 'branch-1' },
      warehouse: { id: 'warehouse-1' },
      cashRegister: null,
    },
  };

  beforeEach(async () => {
    store.entities.mockReset().mockImplementation((_: unknown, kind: string) => {
      if (kind === 'PRODUCT') {
        return Promise.resolve([
          { kind, id: 'product-1', sku: 'SKU-1', name: 'Producto', active: true },
        ]);
      }
      if (kind === 'LOCATION') {
        return Promise.resolve([
          {
            kind,
            id: 'location-1',
            warehouseId: 'warehouse-1',
            code: 'GEN',
            name: 'General',
            active: true,
          },
        ]);
      }
      return Promise.resolve([
        {
          kind,
          id: 'product-1:location-1',
          productId: 'product-1',
          locationId: 'location-1',
          availableQuantity: '5.000',
        },
      ]);
    });
    store.queue.mockReset().mockResolvedValue({ sequence: 1 });
    store.freshness.mockReset().mockResolvedValue({
      condition: 'FRESH',
      catalogReadable: true,
      allowedActions: { INVENTORY_COUNT: true, INVENTORY_MOVEMENT: true, CASH_SALE: true },
    });
    store.assertAction.mockReset().mockResolvedValue(undefined);
    await TestBed.configureTestingModule({
      imports: [OfflineInventoryPanelComponent],
      providers: [
        { provide: OfflineStoreService, useValue: store },
        { provide: SessionApiService, useValue: { session: () => session } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(OfflineInventoryPanelComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('queues an authorized count with its observed balance and evidence', async () => {
    const component = fixture.componentInstance as unknown as {
      form: {
        patchValue(value: Record<string, string>): void;
      };
      submit(): Promise<void>;
      operations(): Array<{ value: string }>;
    };
    expect(component.operations().map(({ value }) => value)).toEqual([
      'COUNT',
      'ENTRY',
      'EXIT',
      'RETURN',
      'LOSS',
      'DAMAGE',
    ]);
    component.form.patchValue({
      operation: 'COUNT',
      productId: 'product-1',
      locationId: 'location-1',
      quantity: '4',
      reason: 'Conteo de cierre',
      reference: 'FOTO-001',
    });

    await component.submit();

    expect(store.queue).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', userId: 'user-1' }),
      'INVENTORY_COUNT',
      expect.objectContaining({
        productId: 'product-1',
        locationId: 'location-1',
        countedQuantity: '4.000',
        snapshotQuantity: '5.000',
        reference: 'FOTO-001',
        capturedAt: expect.any(String),
      }),
    );
  });
});
