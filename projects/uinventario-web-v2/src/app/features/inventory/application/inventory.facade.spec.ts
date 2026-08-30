import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InventoryGateway } from '../domain/inventory.gateway';
import { InventoryFacade } from './inventory.facade';

describe('InventoryFacade', () => {
  const gateway = {
    listStock: vi.fn(),
    listMovements: vi.fn(),
    listLocations: vi.fn(),
    getProduct: vi.fn(),
    createMovement: vi.fn(),
    createStateTransition: vi.fn(),
  };
  let facade: InventoryFacade;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [InventoryFacade, { provide: InventoryGateway, useValue: gateway }],
    });
    facade = TestBed.inject(InventoryFacade);
  });

  it('forwards server-side stock and movement queries unchanged', () => {
    const stockQuery = { q: 'café', page: 2, pageSize: 20 };
    const movementQuery = { type: 'ENTRY' as const, page: 1, pageSize: 20 };
    gateway.listStock.mockReturnValue(of({ items: [] }));
    gateway.listMovements.mockReturnValue(of({ items: [] }));

    facade.listStock(stockQuery).subscribe();
    facade.listMovements(movementQuery).subscribe();

    expect(gateway.listStock).toHaveBeenCalledWith(stockQuery);
    expect(gateway.listMovements).toHaveBeenCalledWith(movementQuery);
  });

  it('forwards validated movement and state-transition commands', () => {
    const movement = {
      productId: 'product-id',
      locationId: 'location-id',
      type: 'ENTRY' as const,
      quantity: '4',
      reason: 'Recepción manual',
      reference: 'DOC-42',
    };
    const transition = {
      productId: 'product-id',
      locationId: 'location-id',
      fromState: 'AVAILABLE' as const,
      toState: 'DAMAGED' as const,
      quantity: '1',
      reason: 'Daño detectado',
      reference: 'QA-9',
    };
    gateway.createMovement.mockReturnValue(of({ id: 'movement-id' }));
    gateway.createStateTransition.mockReturnValue(of({ id: 'transition-id' }));

    facade.createMovement(movement).subscribe();
    facade.createStateTransition(transition).subscribe();

    expect(gateway.createMovement).toHaveBeenCalledWith(movement);
    expect(gateway.createStateTransition).toHaveBeenCalledWith(transition);
  });
});
