import { describe, expect, it } from 'vitest';
import { SessionData } from '../../../../core/session/session.models';
import { cartStorageKey, parsePersistedCart } from './pos-cart.persistence';

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
});
