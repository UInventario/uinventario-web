import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CatalogGateway } from '../domain/catalog.gateway';
import { CatalogFacade } from './catalog.facade';

describe('CatalogFacade', () => {
  const gateway = {
    listProducts: vi.fn(),
    getOptions: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    retireProduct: vi.fn(),
    listClassifications: vi.fn(),
    createClassification: vi.fn(),
    updateClassification: vi.fn(),
    retireClassification: vi.fn(),
    previewImport: vi.fn(),
    confirmImport: vi.fn(),
    downloadImportResult: vi.fn(),
  };
  let facade: CatalogFacade;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [CatalogFacade, { provide: CatalogGateway, useValue: gateway }],
    });
    facade = TestBed.inject(CatalogFacade);
  });

  it('normalizes product identifiers and optional classification fields', () => {
    gateway.createProduct.mockReturnValue(of({}));
    facade
      .saveProduct({
        name: ' Café molido ',
        sku: ' cafe-01 ',
        barcode: ' ',
        withoutCode: false,
        stockBehavior: 'TRACKED',
        taxBehavior: 'STANDARD',
        baseUnit: 'UNIT',
        quantityPrecision: 0,
        quantityRounding: 'HALF_UP',
        minimumQuantity: ' 1 ',
        trackLots: false,
        trackSerials: false,
        categoryName: ' Bebidas ',
        brandName: ' ',
        cost: ' 80.00 ',
        price: ' 119.90 ',
      })
      .subscribe();
    expect(gateway.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Café molido',
        sku: 'CAFE-01',
        barcode: undefined,
        categoryName: 'Bebidas',
        brandName: undefined,
        cost: '80.00',
        price: '119.90',
        minimumQuantity: '1',
      }),
    );
  });

  it('omits sku for products intentionally created without code', () => {
    gateway.updateProduct.mockReturnValue(of({}));
    facade
      .saveProduct(
        {
          name: 'Servicio',
          sku: 'IGNORED',
          withoutCode: true,
          stockBehavior: 'UNTRACKED',
          taxBehavior: 'EXEMPT',
          baseUnit: 'UNIT',
          quantityPrecision: 0,
          quantityRounding: 'HALF_UP',
          minimumQuantity: '1',
          trackLots: false,
          trackSerials: false,
          cost: '0',
          price: '50',
        },
        { id: 'product-1', version: 3 },
      )
      .subscribe();
    expect(gateway.updateProduct).toHaveBeenCalledWith(
      'product-1',
      expect.objectContaining({ sku: undefined, withoutCode: true }),
      3,
    );
  });
});
