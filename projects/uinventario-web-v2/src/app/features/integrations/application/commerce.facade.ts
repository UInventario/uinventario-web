import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { ApiError } from '../../../core/api/api-error';
import { CommerceGateway } from '../domain/commerce.gateway';
import {
  CommerceContract,
  CommerceCredentialInput,
  CommerceLoadResult,
  CommerceOperation,
  CommerceSnapshot,
} from '../domain/commerce.models';

@Injectable()
export class CommerceFacade {
  private readonly gateway = inject(CommerceGateway);

  load(): Observable<CommerceSnapshot> {
    return forkJoin({
      credentials: this.isolate(this.gateway.credentials()),
      deliveries: this.isolate(this.gateway.deliveries()),
      contract: this.isolate(this.gateway.contract()),
      options: this.isolate(this.gateway.options()),
    });
  }

  create(input: CommerceCredentialInput) {
    return this.gateway.create({
      ...input,
      name: input.name.trim(),
      webhookUrl: input.webhookUrl?.trim() || undefined,
      scopes: [...new Set(input.scopes)],
      webhookEvents: [...new Set(input.webhookEvents)],
    });
  }

  rotate(id: string) {
    return this.gateway.rotate(id);
  }

  revoke(id: string) {
    return this.gateway.revoke(id);
  }

  replay(id: string) {
    return this.gateway.replay(id);
  }

  operations(contract: CommerceContract | null): readonly CommerceOperation[] {
    if (!contract) return [];
    return Object.entries(contract.paths).flatMap(([path, methods]) =>
      Object.entries(methods).map(([method, operation]) => ({
        method: method.toUpperCase(),
        path,
        summary: operation.summary,
        scope: operation['x-required-scope'],
        idempotent:
          method.toUpperCase() === 'GET' || operation.summary.toLowerCase().includes('idempotente'),
      })),
    );
  }

  private isolate<T>(request: Observable<T>): Observable<CommerceLoadResult<T>> {
    return request.pipe(
      map((data) => ({ data, error: null })),
      catchError((error: unknown) => of({ data: null, error: this.message(error) })),
    );
  }

  private message(error: unknown): string {
    return error instanceof ApiError ? error.message : 'No fue posible consultar esta fuente.';
  }
}
