import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';

export type InventoryMovementType = 'INITIAL' | 'ENTRY' | 'ADJUSTMENT';

export interface InventoryLocationData {
  id: string;
  name: string;
  code: string;
}

export interface InventoryBalanceData {
  product: { id: string; name: string; sku: string };
  location: InventoryLocationData;
  quantity: string;
}

export interface InventoryMovementInput {
  productId: string;
  locationId: string;
  type: InventoryMovementType;
  quantity: string;
  reason: string;
  reference?: string;
}

interface LocationsResponse {
  data: InventoryLocationData[];
  meta: { apiVersion: '1' };
}

interface BalanceResponse {
  data: InventoryBalanceData;
  meta: { apiVersion: '1' };
}

interface MovementResponse {
  data: InventoryBalanceData & {
    id: string;
    type: InventoryMovementType;
    quantityChange: string;
    reason: string;
    reference: string | null;
    createdAt: string;
  };
  meta: { apiVersion: '1'; idempotentReplay: boolean };
}

@Injectable({ providedIn: 'root' })
export class InventoryApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  listLocations() {
    return this.http.get<LocationsResponse>(`${this.config.apiBaseUrl()}/inventory/locations`, {
      withCredentials: true,
    });
  }

  getBalance(productId: string, locationId: string) {
    const params = new HttpParams().set('locationId', locationId);
    return this.http.get<BalanceResponse>(
      `${this.config.apiBaseUrl()}/inventory/products/${productId}/balance`,
      { params, withCredentials: true },
    );
  }

  createMovement(input: InventoryMovementInput, idempotencyKey: string) {
    const headers = new HttpHeaders().set('Idempotency-Key', idempotencyKey);
    return this.http.post<MovementResponse>(
      `${this.config.apiBaseUrl()}/inventory/movements`,
      input,
      { headers, withCredentials: true },
    );
  }
}
