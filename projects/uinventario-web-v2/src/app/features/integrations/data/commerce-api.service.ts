import { Injectable, inject } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';
import { ApiClient } from '../../../core/api/api-client';
import { ApiEnvelope } from '../../../core/api/api-contracts';
import { CommerceGateway } from '../domain/commerce.gateway';
import {
  CommerceContract,
  CommerceCredential,
  CommerceCredentialInput,
  CommerceDelivery,
  CommerceOptions,
  IssuedCommerceCredential,
} from '../domain/commerce.models';

interface BranchData {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
  readonly warehouses: readonly {
    readonly id: string;
    readonly name: string;
    readonly active: boolean;
    readonly locations: readonly {
      readonly id: string;
      readonly name: string;
      readonly code: string;
      readonly active: boolean;
    }[];
  }[];
  readonly cashRegisters: readonly {
    readonly id: string;
    readonly name: string;
    readonly code: string;
  }[];
}

interface CustomerData {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
}

interface IssuedResponse {
  readonly data: CommerceCredential & { readonly apiKey: string };
}

@Injectable()
export class CommerceApi extends CommerceGateway {
  private readonly api = inject(ApiClient);
  private readonly base = '/integrations/commerce';

  override credentials() {
    return this.data<readonly CommerceCredential[]>(this.api.get(`${this.base}/credentials`));
  }

  override deliveries() {
    return this.data<readonly CommerceDelivery[]>(this.api.get(`${this.base}/webhook-deliveries`));
  }

  override contract() {
    return this.api.get<CommerceContract>(`${this.base}/openapi`);
  }

  override options(): Observable<CommerceOptions> {
    return forkJoin({
      branches: this.data<readonly BranchData[]>(this.api.get('/organization/branches')),
      customers: this.api.get<{
        readonly data: readonly CustomerData[];
      }>('/customers', { params: { status: 'ACTIVE', page: 1, pageSize: 100 } }),
    }).pipe(
      map(({ branches, customers }) => ({
        contexts: branches
          .filter(({ active }) => active)
          .flatMap((branch) =>
            branch.warehouses
              .filter(({ active }) => active)
              .flatMap((warehouse) =>
                warehouse.locations
                  .filter(({ active }) => active)
                  .flatMap((location) =>
                    branch.cashRegisters.map((cashRegister) => ({
                      id: `${branch.id}:${warehouse.id}:${location.id}:${cashRegister.id}`,
                      label: `${branch.name} · ${warehouse.name} · ${location.name} · ${cashRegister.name}`,
                      branchId: branch.id,
                      warehouseId: warehouse.id,
                      cashRegisterId: cashRegister.id,
                      locationId: location.id,
                    })),
                  ),
              ),
          ),
        customers: customers.data
          .filter(({ active }) => active)
          .map(({ id, name }) => ({ id, name })),
      })),
    );
  }

  override create(input: CommerceCredentialInput) {
    return this.issued(
      this.api.post(`${this.base}/credentials`, input, this.idempotency('create')),
    );
  }

  override rotate(id: string) {
    return this.issued(
      this.api.post(
        `${this.base}/credentials/${encodeURIComponent(id)}/rotate`,
        {},
        this.idempotency('rotate'),
      ),
    );
  }

  override revoke(id: string) {
    return this.api
      .delete(`${this.base}/credentials/${encodeURIComponent(id)}`)
      .pipe(map(() => undefined));
  }

  override replay(deliveryId: string) {
    return this.data<CommerceDelivery>(
      this.api.post(
        `${this.base}/webhook-deliveries/${encodeURIComponent(deliveryId)}/replay`,
        {},
        this.idempotency('replay'),
      ),
    );
  }

  private issued(request: Observable<unknown>) {
    return (request as Observable<IssuedResponse>).pipe(
      map(({ data }) => {
        const { apiKey, ...credential } = data;
        return { credential, oneTimeApiKey: apiKey } satisfies IssuedCommerceCredential;
      }),
    );
  }

  private data<T>(request: Observable<unknown>) {
    return (request as Observable<ApiEnvelope<T>>).pipe(map(({ data }) => data));
  }

  private idempotency(action: string) {
    return { headers: { 'Idempotency-Key': `commerce-${action}-${crypto.randomUUID()}` } };
  }
}
