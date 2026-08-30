import { Injectable, inject, signal } from '@angular/core';
import { ApiRequestContext } from '../api/api-request-context';
import { SessionData, SessionResponse } from './session.models';

@Injectable({ providedIn: 'root' })
export class SessionState {
  private readonly apiContext = inject(ApiRequestContext);
  private readonly activeSession = signal<SessionData | null>(null);
  private readonly activeExpiration = signal<number | null>(null);

  readonly session = this.activeSession.asReadonly();
  readonly expiresAt = this.activeExpiration.asReadonly();

  accept(response: SessionResponse): SessionData {
    const expiresAt = Date.parse(response.meta.sessionExpiresAt);
    if (!Number.isFinite(expiresAt))
      throw new Error('La sesión recibida no tiene una expiración válida.');

    this.apiContext.setTenantFromSession(response.data.tenant.id);
    this.activeSession.set(response.data);
    this.activeExpiration.set(expiresAt);
    return response.data;
  }

  clear(): void {
    this.apiContext.clearTenant();
    this.activeSession.set(null);
    this.activeExpiration.set(null);
  }
}
