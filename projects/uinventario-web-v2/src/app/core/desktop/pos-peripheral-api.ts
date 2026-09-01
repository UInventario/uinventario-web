import { HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../api/api-client';
import { ApiEnvelope } from '../api/api-contracts';
import {
  PosPeripheralOperation,
  PosPeripheralProfile,
  PosReceiptForPeripheral,
} from './desktop-peripheral.models';

@Injectable({ providedIn: 'root' })
export class PosPeripheralApi {
  private readonly api = inject(ApiClient);

  profile() {
    return this.api
      .get<ApiEnvelope<PosPeripheralProfile>>('/pos/peripherals/profile')
      .pipe(map(({ data }) => data));
  }

  printReceipt(saleId: string, idempotencyKey: string) {
    return this.api
      .post<
        ApiEnvelope<{
          readonly receipt: PosReceiptForPeripheral;
          readonly operation: PosPeripheralOperation;
        }>,
        Record<string, never>
      >(
        `/pos/peripherals/receipts/${encodeURIComponent(saleId)}/prints`,
        {},
        {
          headers: this.idempotency(idempotencyKey),
        },
      )
      .pipe(map(({ data }) => data));
  }

  openDrawer(
    input: { readonly trigger: 'MANUAL' | 'CASH_SALE_COMPLETED'; readonly saleId?: string },
    idempotencyKey: string,
  ) {
    return this.api
      .post<ApiEnvelope<PosPeripheralOperation>, typeof input>(
        '/pos/peripherals/cash-drawer/openings',
        input,
        { headers: this.idempotency(idempotencyKey) },
      )
      .pipe(map(({ data }) => data));
  }

  private idempotency(value: string): HttpHeaders {
    return new HttpHeaders({ 'Idempotency-Key': value });
  }
}
