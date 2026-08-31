import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../../../../core/api/api-client';
import { ApiEnvelope } from '../../../../core/api/api-contracts';
import { TraceabilityGateway } from '../domain/traceability.gateway';
import {
  InventoryLot,
  InventoryLots,
  InventorySerial,
  InventorySerialHistory,
  LotExpirationAlert,
} from '../domain/traceability.models';

interface LotsResponse extends ApiEnvelope<readonly InventoryLot[]> {
  readonly meta: ApiEnvelope<readonly InventoryLot[]>['meta'] & Omit<InventoryLots, 'items'>;
}

interface AlertsResponse extends ApiEnvelope<readonly LotExpirationAlert[]> {
  readonly meta: ApiEnvelope<readonly LotExpirationAlert[]>['meta'] & {
    readonly businessDate: string;
  };
}

interface SerialsResponse extends ApiEnvelope<readonly InventorySerial[]> {
  readonly meta: ApiEnvelope<readonly InventorySerial[]>['meta'] & { readonly tracked: boolean };
}

@Injectable()
export class TraceabilityApi extends TraceabilityGateway {
  private readonly api = inject(ApiClient);

  override listLots(productId: string) {
    return this.api
      .get<LotsResponse>(`/inventory/products/${encodeURIComponent(productId)}/lots`)
      .pipe(map(({ data, meta }) => ({ items: data, ...meta })));
  }

  override listExpirationAlerts() {
    return this.api
      .get<AlertsResponse>('/inventory/lot-expiration-alerts')
      .pipe(map(({ data, meta }) => ({ items: data, businessDate: meta.businessDate })));
  }

  override listSerials(productId: string) {
    return this.api
      .get<SerialsResponse>(`/inventory/products/${encodeURIComponent(productId)}/serials`)
      .pipe(map(({ data, meta }) => ({ items: data, tracked: meta.tracked })));
  }

  override serialHistory(serialId: string) {
    return this.api
      .get<ApiEnvelope<InventorySerialHistory>>(
        `/inventory/serials/${encodeURIComponent(serialId)}/history`,
      )
      .pipe(map(({ data }) => data));
  }
}
