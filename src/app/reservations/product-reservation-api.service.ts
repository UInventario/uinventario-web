import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';

export interface ProductReservationData {
  id: string;
  reservationNumber: string;
  status: 'ACTIVE';
  customer: { id: string; name: string; identifier: string | null };
  context: {
    branch: { id: string; name: string };
    warehouse: { id: string; name: string };
    location: { id: string; name: string; code: string };
  };
  responsible: { id: string; email: string };
  expiresAt: string;
  createdAt: string;
  lines: Array<{
    id: string;
    product: { id: string; name: string; sku: string };
    quantity: string;
  }>;
}

export interface ProductReservationInput {
  customerId: string;
  locationId: string;
  expiresInHours: number;
  lines: Array<{ productId: string; quantity: string }>;
}

@Injectable({ providedIn: 'root' })
export class ProductReservationApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  list() {
    return this.http.get<{ data: ProductReservationData[]; meta: { apiVersion: '1' } }>(
      `${this.config.apiBaseUrl()}/reservations`,
      { withCredentials: true },
    );
  }

  create(input: ProductReservationInput, idempotencyKey: string) {
    return this.http.post<{
      data: ProductReservationData;
      meta: { apiVersion: '1'; idempotentReplay: boolean };
    }>(`${this.config.apiBaseUrl()}/reservations`, input, {
      withCredentials: true,
      headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
    });
  }
}
