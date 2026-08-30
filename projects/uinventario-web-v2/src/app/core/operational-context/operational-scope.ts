import { Injectable, computed, inject } from '@angular/core';
import { SessionState } from '../session/session-state';

@Injectable({ providedIn: 'root' })
export class OperationalScope {
  private readonly sessions = inject(SessionState);

  readonly tenantKey = computed(() => this.sessions.session()?.tenant.id ?? null);
  readonly scopeKey = computed(() => {
    const session = this.sessions.session();
    if (!session) return null;
    const { branch, warehouse, cashRegister } = session.context;
    return [
      session.tenant.id,
      branch?.id ?? '-',
      warehouse?.id ?? '-',
      cashRegister?.id ?? '-',
    ].join(':');
  });
}
