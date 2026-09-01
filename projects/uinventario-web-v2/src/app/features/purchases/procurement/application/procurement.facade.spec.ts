import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ProcurementGateway } from '../domain/procurement.gateway';
import { PurchaseOrder, PurchaseOrderInput } from '../domain/procurement.models';
import { ProcurementFacade } from './procurement.facade';

describe('ProcurementFacade', () => {
  const order = { id: 'order-1', version: 3 } as PurchaseOrder;
  const input: PurchaseOrderInput = {
    supplierId: 'supplier-1',
    currency: 'MXN',
    lines: [{ supplierProductId: 'link-1', quantity: '2', unitCost: '10.00' }],
  };
  const gateway = {
    create: vi.fn(() => of(order)),
    update: vi.fn(() => of(order)),
    approve: vi.fn(() => of(order)),
    send: vi.fn(() => of(order)),
    cancel: vi.fn(() => of(order)),
  };
  let facade: ProcurementFacade;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [ProcurementFacade, { provide: ProcurementGateway, useValue: gateway }],
    });
    facade = TestBed.inject(ProcurementFacade);
  });

  it('creates a new order and updates an existing draft with optimistic versioning', () => {
    facade.save(input).subscribe();
    facade.save(input, order).subscribe();
    expect(gateway.create).toHaveBeenCalledWith(input);
    expect(gateway.update).toHaveBeenCalledWith('order-1', input, 3);
  });

  it('routes each state transition to the explicit gateway operation', () => {
    facade.transition(order, 'APPROVE', 'key-approve', 'Presupuesto aprobado').subscribe();
    facade.transition(order, 'SEND', 'key-send').subscribe();
    facade.transition(order, 'CANCEL', 'key-cancel', 'Proveedor no disponible').subscribe();
    expect(gateway.approve).toHaveBeenCalledWith(
      'order-1',
      3,
      'key-approve',
      'Presupuesto aprobado',
    );
    expect(gateway.send).toHaveBeenCalledWith('order-1', 3, 'key-send');
    expect(gateway.cancel).toHaveBeenCalledWith(
      'order-1',
      3,
      'Proveedor no disponible',
      'key-cancel',
    );
  });
});
