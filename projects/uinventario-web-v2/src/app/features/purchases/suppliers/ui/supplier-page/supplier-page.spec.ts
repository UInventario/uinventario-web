import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupplierFacade } from '../../application/supplier.facade';
import { Supplier } from '../../domain/supplier.models';
import { SupplierPage } from './supplier-page';

describe('SupplierPage', () => {
  const supplier: Supplier = {
    id: '57b74392-2a7d-4e65-88d3-5b40d7f4f027',
    legalName: 'Distribuidora Norte SA',
    tradeName: 'Norte',
    countryCode: 'MX',
    identifierType: 'RFC',
    taxIdentifier: 'DIN010203AB1',
    active: true,
    version: 2,
    contacts: [
      {
        id: 'contact-1',
        name: 'Ana Compras',
        email: 'ana@example.com',
        phone: null,
        role: 'Ventas',
        primary: true,
      },
    ],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-30T00:00:00.000Z',
  };
  const params = convertToParamMap({
    q: 'norte',
    status: 'ALL',
    page: '2',
    supplier: supplier.id,
    view: 'productos',
    productQ: 'café',
    productPage: '3',
  });
  const facade = {
    list: vi.fn(),
    get: vi.fn(),
    save: vi.fn(),
    deactivate: vi.fn(),
    listProducts: vi.fn(),
    getProduct: vi.fn(),
    saveProduct: vi.fn(),
    searchCatalogProducts: vi.fn(),
  };
  const router = { navigate: vi.fn().mockResolvedValue(true) };

  beforeEach(() => {
    vi.clearAllMocks();
    facade.list.mockReturnValue(
      of({
        suppliers: [supplier],
        pagination: { page: 2, pageSize: 20, total: 21, totalPages: 2 },
      }),
    );
    facade.get.mockReturnValue(of(supplier));
    facade.listProducts.mockReturnValue(
      of({
        products: [],
        pagination: { page: 3, pageSize: 10, total: 0, totalPages: 0 },
      }),
    );
    TestBed.configureTestingModule({
      imports: [SupplierPage],
      providers: [
        { provide: SupplierFacade, useValue: facade },
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: of(params), snapshot: { queryParamMap: params } },
        },
        { provide: Router, useValue: router },
      ],
    });
  });

  it('restores supplier and product filters plus pagination from the URL', () => {
    const fixture = TestBed.createComponent(SupplierPage);
    fixture.detectChanges();

    expect(facade.list).toHaveBeenCalledWith({
      q: 'norte',
      status: 'ALL',
      page: 2,
      pageSize: 20,
    });
    expect(facade.get).toHaveBeenCalledWith(supplier.id);
    expect(facade.listProducts).toHaveBeenCalledWith({
      supplierId: supplier.id,
      q: 'café',
      page: 3,
      pageSize: 10,
    });
  });

  it('requires the exact legal name before enabling retirement', () => {
    const fixture = TestBed.createComponent(SupplierPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('.danger-outline')!.click();
    fixture.detectChanges();

    const confirmation = element.querySelector<HTMLInputElement>('#retireSupplierConfirmation')!;
    const retire = element.querySelector<HTMLButtonElement>('.danger-button')!;
    expect(retire.disabled).toBe(true);
    confirmation.value = supplier.legalName;
    confirmation.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(retire.disabled).toBe(false);
  });
});
