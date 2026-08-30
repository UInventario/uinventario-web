import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupplierGateway } from '../domain/supplier.gateway';
import { Supplier, SupplierProduct } from '../domain/supplier.models';
import { SupplierFacade } from './supplier.facade';

describe('SupplierFacade', () => {
  const gateway = {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
    listProducts: vi.fn(),
    getProduct: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    searchCatalogProducts: vi.fn(),
  };
  let facade: SupplierFacade;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [SupplierFacade, { provide: SupplierGateway, useValue: gateway }],
    });
    facade = TestBed.inject(SupplierFacade);
  });

  it('preserves optimistic versions when saving suppliers', () => {
    const input = {
      legalName: 'Distribuidora Norte SA',
      taxIdentifier: 'DIN010203AB1',
      contacts: [],
    };
    const supplier = { id: 'supplier-1', version: 7 } as Supplier;
    gateway.create.mockReturnValue(of(supplier));
    gateway.update.mockReturnValue(of(supplier));

    facade.save(input).subscribe();
    facade.save(input, supplier).subscribe();

    expect(gateway.create).toHaveBeenCalledWith(input);
    expect(gateway.update).toHaveBeenCalledWith('supplier-1', input, 7);
  });

  it('preserves link versions and routes catalog search through its gateway', () => {
    const input = {
      supplierId: 'supplier-1',
      productId: 'product-1',
      supplierCode: 'REF-42',
      currency: 'MXN',
      unitCost: '12.50',
      validFrom: '2026-08-30',
    };
    const link = { id: 'link-1', version: 3 } as SupplierProduct;
    gateway.createProduct.mockReturnValue(of(link));
    gateway.updateProduct.mockReturnValue(of(link));
    gateway.searchCatalogProducts.mockReturnValue(of({ products: [], pagination: {} }));

    facade.saveProduct(input).subscribe();
    facade.saveProduct(input, link).subscribe();
    facade.searchCatalogProducts('café').subscribe();

    expect(gateway.createProduct).toHaveBeenCalledWith(input);
    expect(gateway.updateProduct).toHaveBeenCalledWith('link-1', input, 3);
    expect(gateway.searchCatalogProducts).toHaveBeenCalledWith('café');
  });
});
