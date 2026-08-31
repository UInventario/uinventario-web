import { beforeEach, describe, expect, it } from 'vitest';
import { SessionData } from '../../../../core/session/session.models';
import {
  cartStorageKey,
  clearPendingSuspendedSale,
  parsePersistedCart,
  readPendingSuspendedSale,
  writePendingSuspendedSale,
} from './pos-cart.persistence';

const session = (cashRegisterId: string) =>
  ({
    user: { id: 'user-1', email: 'cashier@example.com', roles: [], permissions: ['SALES_MANAGE'] },
    tenant: { id: 'tenant-1', name: 'Tienda' },
    context: {
      branch: { id: 'branch-1', name: 'Centro' },
      warehouse: { id: 'warehouse-1', name: 'Principal' },
      cashRegister: { id: cashRegisterId, name: 'Caja', code: 'C-01' },
    },
    nextStep: 'APPLICATION',
  }) satisfies SessionData;

describe('POS cart persistence', () => {
  beforeEach(() => sessionStorage.clear());

  it('isolates drafts by tenant, user and complete operational context', () => {
    expect(cartStorageKey(session('register-1'))).not.toBe(cartStorageKey(session('register-2')));
    expect(
      cartStorageKey({
        ...session('register-1'),
        context: { ...session('register-1').context, cashRegister: null },
      }),
    ).toBeNull();
  });

  it('drops malformed persisted lines instead of trusting browser storage', () => {
    expect(parsePersistedCart('{bad-json')).toEqual([]);
    expect(
      parsePersistedCart(JSON.stringify([{ product: { id: 'product-1' }, quantity: '1' }])),
    ).toEqual([]);
  });

  it('accepts the safe product snapshot produced when a suspended sale is resumed', () => {
    expect(
      parsePersistedCart(
        JSON.stringify([
          {
            product: {
              id: 'product-1',
              name: 'Café',
              sku: 'CAF-01',
              barcode: null,
              withoutCode: false,
              stockBehavior: 'TRACKED',
              taxBehavior: 'STANDARD',
              baseUnit: 'UNIT',
              quantityPrecision: 0,
              quantityRounding: 'HALF_UP',
              minimumQuantity: '1.000',
              trackLots: false,
              trackSerials: false,
              price: '120.00',
              active: true,
              sellable: true,
            },
            quantity: '1.000',
          },
        ]),
      ),
    ).toHaveLength(1);
  });

  it('restores only validated discount fields from the scoped cart draft', () => {
    const raw = JSON.stringify([
      {
        product: {
          id: 'product-1',
          name: 'CafÃ©',
          sku: 'CAF-01',
          barcode: null,
          withoutCode: false,
          stockBehavior: 'TRACKED',
          taxBehavior: 'STANDARD',
          baseUnit: 'UNIT',
          quantityPrecision: 0,
          quantityRounding: 'HALF_UP',
          minimumQuantity: '1.000',
          trackLots: false,
          trackSerials: false,
          price: '120.00',
          active: true,
          sellable: true,
        },
        quantity: '1.000',
        discount: { type: 'PERCENT', value: '10', reason: 'Cliente frecuente' },
      },
    ]);
    expect(parsePersistedCart(raw)[0]?.discount).toEqual({
      type: 'PERCENT',
      value: '10',
      reason: 'Cliente frecuente',
    });
  });

  it('keeps a resumed sale scoped to the complete operational context', () => {
    const lines = parsePersistedCart(
      JSON.stringify([
        {
          product: {
            id: 'product-1',
            name: 'Café',
            sku: 'CAF-01',
            barcode: null,
            withoutCode: false,
            stockBehavior: 'TRACKED',
            taxBehavior: 'STANDARD',
            baseUnit: 'UNIT',
            quantityPrecision: 0,
            quantityRounding: 'HALF_UP',
            minimumQuantity: '1.000',
            trackLots: false,
            trackSerials: false,
            price: '120.00',
            active: true,
            sellable: true,
          },
          quantity: '1.000',
        },
      ]),
    );
    expect(
      writePendingSuspendedSale(session('register-1'), {
        id: 'suspended-1',
        customerId: 'customer-1',
        lines,
      }),
    ).toBe(true);
    expect(readPendingSuspendedSale(session('register-1'))).toMatchObject({
      id: 'suspended-1',
      customerId: 'customer-1',
    });
    expect(readPendingSuspendedSale(session('register-2'))).toBeNull();
    clearPendingSuspendedSale(session('register-1'));
    expect(readPendingSuspendedSale(session('register-1'))).toBeNull();
  });
});
