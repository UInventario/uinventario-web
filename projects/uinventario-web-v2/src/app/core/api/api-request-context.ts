import { Injectable, signal } from '@angular/core';

const CONTEXT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

@Injectable({ providedIn: 'root' })
export class ApiRequestContext {
  private readonly activeTenantId = signal<string | null>(null);

  readonly tenantId = this.activeTenantId.asReadonly();

  setTenantFromSession(tenantId: string): void {
    const normalized = tenantId.trim();
    if (!CONTEXT_ID_PATTERN.test(normalized)) {
      throw new Error('El identificador de tenant recibido de la sesión no es válido.');
    }
    this.activeTenantId.set(normalized);
  }

  clearTenant(): void {
    this.activeTenantId.set(null);
  }

  createCorrelationId(): string {
    return `web:${crypto.randomUUID()}`;
  }
}
