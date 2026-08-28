import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ProductApiService, ProductData } from '../catalog/product-api.service';
import { InventoryApiService, InventoryCountSessionData } from './inventory-api.service';
import { InventoryCountPanelComponent } from './inventory-count-panel.component';

describe('InventoryCountPanelComponent', () => {
  let fixture: ComponentFixture<InventoryCountPanelComponent>;
  const product: ProductData = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Producto contado',
    sku: 'COUNT-1',
    barcode: null,
    category: null,
    brand: null,
    cost: '1.00',
    price: '2.00',
    active: true,
    version: 1,
  };
  const openSession: InventoryCountSessionData = {
    id: '22222222-2222-4222-8222-222222222222',
    status: 'OPEN',
    blind: true,
    branch: { id: 'branch', name: 'Sucursal' },
    warehouse: { id: 'warehouse', name: 'Bodega' },
    location: { id: 'location', name: 'General', code: 'GENERAL' },
    createdBy: { id: 'user', email: 'contador@example.com' },
    closedBy: null,
    createdAt: '2026-08-27T10:00:00.000Z',
    closedAt: null,
    lines: [
      {
        product,
        snapshotQuantity: null,
        countedQuantity: null,
        varianceQuantity: null,
        attemptCount: 0,
        countedBy: null,
        countedAt: null,
        movementId: null,
        attempts: [],
      },
    ],
  };
  const inventory = {
    listLocations: vi.fn(),
    listCountSessions: vi.fn(),
    getCountSession: vi.fn(),
    createCountSession: vi.fn(),
    recordCount: vi.fn(),
    closeCountSession: vi.fn(),
  };
  const products = { list: vi.fn(), resolveCode: vi.fn() };

  beforeEach(async () => {
    inventory.listLocations.mockReturnValue(
      of({ data: [openSession.location], meta: { apiVersion: '1' } }),
    );
    inventory.listCountSessions.mockReturnValue(of({ data: [], meta: { apiVersion: '1' } }));
    inventory.createCountSession.mockReturnValue(
      of({ data: openSession, meta: { apiVersion: '1', idempotentReplay: false } }),
    );
    products.list.mockReturnValue(
      of({
        data: [product],
        meta: { pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 } },
      }),
    );
    products.resolveCode.mockReturnValue(of({ data: product }));
    await TestBed.configureTestingModule({
      imports: [InventoryCountPanelComponent],
      providers: [
        { provide: InventoryApiService, useValue: inventory },
        { provide: ProductApiService, useValue: products },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(InventoryCountPanelComponent);
    fixture.componentRef.setInput('canCount', true);
    fixture.componentRef.setInput('canApprove', true);
    fixture.detectChanges();
  });

  it('opens a blind session, preserves recount attempts and reveals the variance only on close', () => {
    const component = fixture.componentInstance as unknown as {
      addProduct(product: ProductData): void;
      createSession(): void;
      updateQuantity(productId: string, event: Event): void;
      record(line: InventoryCountSessionData['lines'][number]): void;
      closeSession(): void;
      closeForm: { setValue(value: { reason: string; reference: string }): void };
      activeSession(): InventoryCountSessionData | null;
    };
    component.addProduct(product);
    component.createSession();
    fixture.detectChanges();
    expect(inventory.createCountSession).toHaveBeenCalledWith(
      { locationId: 'location', productIds: [product.id], blind: true },
      expect.stringMatching(/^web-count-/),
    );
    expect(fixture.nativeElement.textContent).toContain('Oculto');

    const firstAttempt: InventoryCountSessionData = {
      ...openSession,
      lines: [
        {
          ...openSession.lines[0],
          countedQuantity: '8.000',
          attemptCount: 1,
          countedBy: { id: 'user', email: 'contador@example.com' },
          attempts: [
            {
              attempt: 1,
              countedQuantity: '8.000',
              responsible: { id: 'user', email: 'contador@example.com' },
              createdAt: '2026-08-27T10:05:00.000Z',
            },
          ],
        },
      ],
    };
    inventory.recordCount.mockReturnValueOnce(
      of({ data: firstAttempt, meta: { apiVersion: '1' } }),
    );
    component.updateQuantity(product.id, { target: { value: '8' } } as unknown as Event);
    component.record(openSession.lines[0]);
    expect(inventory.recordCount).toHaveBeenLastCalledWith(openSession.id, product.id, {
      countedQuantity: '8',
      expectedAttempt: 0,
    });

    const secondAttempt: InventoryCountSessionData = {
      ...firstAttempt,
      lines: [
        {
          ...firstAttempt.lines[0],
          countedQuantity: '9.000',
          attemptCount: 2,
          attempts: [
            ...firstAttempt.lines[0].attempts,
            {
              attempt: 2,
              countedQuantity: '9.000',
              responsible: { id: 'supervisor', email: 'supervisor@example.com' },
              createdAt: '2026-08-27T10:10:00.000Z',
            },
          ],
        },
      ],
    };
    inventory.recordCount.mockReturnValueOnce(
      of({ data: secondAttempt, meta: { apiVersion: '1' } }),
    );
    component.updateQuantity(product.id, { target: { value: '9' } } as unknown as Event);
    component.record(firstAttempt.lines[0]);
    expect(inventory.recordCount).toHaveBeenLastCalledWith(openSession.id, product.id, {
      countedQuantity: '9',
      expectedAttempt: 1,
    });

    const closedSession: InventoryCountSessionData = {
      ...secondAttempt,
      status: 'CLOSED',
      closedBy: { id: 'supervisor', email: 'supervisor@example.com' },
      closedAt: '2026-08-27T10:15:00.000Z',
      lines: [
        {
          ...secondAttempt.lines[0],
          snapshotQuantity: '10.000',
          varianceQuantity: '-1.000',
          movementId: 'movement',
        },
      ],
    };
    inventory.closeCountSession.mockReturnValueOnce(
      of({ data: closedSession, meta: { apiVersion: '1' } }),
    );
    component.closeForm.setValue({ reason: 'Conteo mensual', reference: 'COUNT-2026-08' });
    component.closeSession();
    fixture.detectChanges();

    expect(inventory.closeCountSession).toHaveBeenCalledWith(openSession.id, {
      reason: 'Conteo mensual',
      reference: 'COUNT-2026-08',
    });
    expect(fixture.nativeElement.textContent).toContain('10.000');
    expect(fixture.nativeElement.textContent).toContain('Diferencia -1.000');
    expect(fixture.nativeElement.textContent).toContain('#2: 9.000');
  });
});
