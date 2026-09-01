import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PricingGateway } from '../domain/pricing.gateway';
import { PriceList, Promotion } from '../domain/pricing.models';
import { PricingFacade } from './pricing.facade';

describe('PricingFacade', () => {
  const gateway = {
    listPriceLists: vi.fn(),
    savePriceList: vi.fn(),
    listPromotions: vi.fn(),
    savePromotion: vi.fn(),
    currentLoyaltyRule: vi.fn(),
    saveLoyaltyRule: vi.fn(),
    searchProducts: vi.fn(),
    searchCustomers: vi.fn(),
  };
  let facade: PricingFacade;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [PricingFacade, { provide: PricingGateway, useValue: gateway }],
    });
    facade = TestBed.inject(PricingFacade);
  });

  it('normalizes and forwards contextual price lists with optimistic versioning', () => {
    const current = { id: 'list-1', version: 3 } as PriceList;
    gateway.savePriceList.mockReturnValue(of(current));
    facade
      .savePriceList(
        {
          name: ' Mayoristas ',
          currency: ' mxn ',
          branchId: 'branch-1',
          customerId: 'customer-1',
          channel: 'POS',
          priority: 20,
          validFrom: '2026-08-31T00:00:00.000Z',
          active: true,
          items: [{ productId: 'product-1', price: ' 95.50 ' }],
        },
        current,
      )
      .subscribe();

    expect(gateway.savePriceList).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Mayoristas',
        currency: 'MXN',
        branchId: 'branch-1',
        customerId: 'customer-1',
        channel: 'POS',
        items: [{ productId: 'product-1', price: '95.50' }],
      }),
      current,
    );
  });

  it('preserves promotion rules while trimming human and numeric inputs', () => {
    const current = { id: 'promotion-1', version: 2 } as Promotion;
    gateway.savePromotion.mockReturnValue(of(current));
    facade
      .savePromotion(
        {
          name: ' Volumen ',
          type: 'QUANTITY_PERCENT',
          priority: 5,
          stackable: false,
          validFrom: '2026-08-31T00:00:00.000Z',
          active: true,
          products: [{ productId: 'product-1', quantity: ' 1 ' }],
          tiers: [{ minimumQuantity: ' 10 ', discountPercent: ' 12.5 ' }],
        },
        current,
      )
      .subscribe();

    expect(gateway.savePromotion).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Volumen',
        products: [{ productId: 'product-1', quantity: '1' }],
        tiers: [{ minimumQuantity: '10', discountPercent: '12.5' }],
      }),
      current,
    );
  });

  it('publishes loyalty rules without changing their integer semantics', () => {
    gateway.saveLoyaltyRule.mockReturnValue(of({}));
    facade
      .saveLoyaltyRule({
        active: true,
        earnAmount: ' 100.00 ',
        earnPoints: 5,
        redeemPoints: 100,
        redeemAmount: ' 10.00 ',
      })
      .subscribe();
    expect(gateway.saveLoyaltyRule).toHaveBeenCalledWith({
      active: true,
      earnAmount: '100.00',
      earnPoints: 5,
      redeemPoints: 100,
      redeemAmount: '10.00',
    });
  });
});
