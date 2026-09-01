import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { ApiError } from '../../../core/api/api-error';
import { IntegrationGateway } from '../domain/integration.gateway';
import {
  AdapterCapability,
  AdapterScenario,
  AdapterUpdate,
  IntegrationSnapshot,
  LoadResult,
  ProviderKey,
} from '../domain/integration.models';

const PROVIDERS: readonly ProviderKey[] = ['fiscal', 'erp', 'psp', 'accounting', 'whatsapp'];

@Injectable()
export class IntegrationFacade {
  private readonly gateway = inject(IntegrationGateway);

  load(): Observable<IntegrationSnapshot> {
    return forkJoin({
      adapters: this.isolate(this.gateway.adapters()),
      executions: this.isolate(this.gateway.executions()),
      emailEvents: this.isolate(this.gateway.emailEvents()),
      providers: forkJoin(PROVIDERS.map((key) => this.isolate(this.gateway.provider(key)))),
    });
  }

  updateAdapter(input: AdapterUpdate) {
    return this.gateway.updateAdapter({
      ...input,
      countryCode: input.countryCode.trim().toUpperCase(),
      provider: input.provider.trim(),
      adapterVersion: input.adapterVersion.trim(),
      secretReference: input.secretReference?.trim() || null,
    });
  }

  diagnose(capability: AdapterCapability, scenario: AdapterScenario) {
    return this.gateway.diagnose(capability, scenario);
  }

  private isolate<T>(request: Observable<T>): Observable<LoadResult<T>> {
    return request.pipe(
      map((data) => ({ data, error: null })),
      catchError((error: unknown) =>
        of({ data: null, error: this.message(error) } satisfies LoadResult<T>),
      ),
    );
  }

  private message(error: unknown): string {
    return error instanceof ApiError ? error.message : 'El proveedor no respondió.';
  }
}
