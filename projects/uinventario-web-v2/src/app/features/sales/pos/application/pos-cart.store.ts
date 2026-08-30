import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { SessionState } from '../../../../core/session/session-state';
import { PosCartLine, PosProduct } from '../domain/pos.models';
import { changeQuantity } from '../domain/quantity';
import {
  cartStorageKey,
  parsePersistedCart,
  readPendingSuspendedSale,
} from './pos-cart.persistence';

@Injectable()
export class PosCartStore {
  private readonly sessions = inject(SessionState);
  private readonly cartLines = signal<readonly PosCartLine[]>([]);
  private readonly activeKey = signal<string | null>(null);

  readonly lines = this.cartLines.asReadonly();

  constructor() {
    this.hydrate(cartStorageKey(this.sessions.session()));
    effect(() => {
      const key = cartStorageKey(this.sessions.session());
      untracked(() => {
        if (key === this.activeKey()) return;
        this.hydrate(key);
      });
    });
    effect(() => {
      const key = this.activeKey();
      const lines = this.cartLines();
      if (!key) return;
      if (lines.length) localStorage.setItem(key, JSON.stringify(lines));
      else localStorage.removeItem(key);
    });
  }

  add(product: PosProduct): void {
    const current = this.cartLines();
    const existing = current.find((line) => line.product.id === product.id);
    if (existing) {
      this.update(product.id, {
        ...existing,
        quantity: changeQuantity(existing.quantity, product, 1),
      });
      return;
    }
    this.cartLines.set([...current, { product, quantity: product.minimumQuantity }]);
  }

  update(productId: string, line: PosCartLine): void {
    this.cartLines.update((lines) =>
      lines.map((candidate) => (candidate.product.id === productId ? line : candidate)),
    );
  }

  change(productId: string, direction: -1 | 1): void {
    const line = this.cartLines().find((candidate) => candidate.product.id === productId);
    if (!line) return;
    this.update(productId, {
      ...line,
      quantity: changeQuantity(line.quantity, line.product, direction),
    });
  }

  remove(productId: string): void {
    this.cartLines.update((lines) => lines.filter((line) => line.product.id !== productId));
  }

  clear(): void {
    this.cartLines.set([]);
  }

  replace(lines: readonly PosCartLine[]): void {
    this.cartLines.set(lines);
  }

  stripUnauthorizedOverrides(): void {
    this.cartLines.update((lines) =>
      lines.map((line) => ({
        product: line.product,
        quantity: line.quantity,
        ...(line.note ? { note: line.note } : {}),
      })),
    );
  }

  private hydrate(key: string | null): void {
    this.activeKey.set(key);
    const resumed = readPendingSuspendedSale(this.sessions.session());
    this.cartLines.set(
      resumed?.lines ?? (key ? parsePersistedCart(localStorage.getItem(key)) : []),
    );
  }
}
