import { Injectable, inject } from '@angular/core';
import { TraceabilityGateway } from '../domain/traceability.gateway';

@Injectable()
export class TraceabilityFacade {
  private readonly gateway = inject(TraceabilityGateway);

  listLots(productId: string) {
    return this.gateway.listLots(productId);
  }

  listExpirationAlerts() {
    return this.gateway.listExpirationAlerts();
  }

  listSerials(productId: string) {
    return this.gateway.listSerials(productId);
  }

  serialHistory(serialId: string) {
    return this.gateway.serialHistory(serialId);
  }
}
