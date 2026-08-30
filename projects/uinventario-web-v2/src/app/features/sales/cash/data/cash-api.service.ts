import { HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../../../../core/api/api-client';
import { ApiEnvelope } from '../../../../core/api/api-contracts';
import { CashGateway } from '../domain/cash.gateway';
import {
  CashClosure,
  CashClosureInput,
  CashMovement,
  CashMovementInput,
  CashShift,
} from '../domain/cash.models';

interface MovementEnvelope {
  readonly data: readonly CashMovement[];
  readonly meta: {
    readonly shiftId: string;
    readonly currency: string;
    readonly expectedCash: string;
  };
}

interface MovementMutationEnvelope {
  readonly data: CashMovement;
  readonly meta: { readonly expectedCash: string };
}

@Injectable()
export class CashApi extends CashGateway {
  private readonly api = inject(ApiClient);

  override currentShift() {
    return this.api
      .get<ApiEnvelope<CashShift | null>>('/pos/register-shifts/current')
      .pipe(map(({ data }) => data));
  }

  override latestClosure() {
    return this.api
      .get<ApiEnvelope<CashClosure | null>>('/pos/register-shifts/latest-closed')
      .pipe(map(({ data }) => data));
  }

  override listMovements() {
    return this.api.get<MovementEnvelope>('/pos/register-shifts/current/movements').pipe(
      map(({ data, meta }) => ({
        movements: data,
        shiftId: meta.shiftId,
        currency: meta.currency,
        expectedCash: meta.expectedCash,
      })),
    );
  }

  override openShift(openingAmount: string) {
    return this.api
      .post<ApiEnvelope<CashShift>, { openingAmount: string }>(
        '/pos/register-shifts',
        { openingAmount },
        { headers: this.idempotencyHeaders('open') },
      )
      .pipe(map(({ data }) => data));
  }

  override createMovement(input: CashMovementInput) {
    return this.api
      .post<MovementMutationEnvelope, CashMovementInput>(
        '/pos/register-shifts/current/movements',
        input,
        { headers: this.idempotencyHeaders('movement') },
      )
      .pipe(map(({ data }) => data));
  }

  override reverseMovement(movementId: string, reason: string) {
    return this.api
      .post<MovementMutationEnvelope, { reason: string }>(
        `/pos/register-shifts/current/movements/${movementId}/reversals`,
        { reason },
        { headers: this.idempotencyHeaders('reversal') },
      )
      .pipe(map(({ data }) => data));
  }

  override closeShift(input: CashClosureInput) {
    return this.api
      .post<ApiEnvelope<CashClosure>, CashClosureInput>(
        '/pos/register-shifts/current/closure',
        input,
        { headers: this.idempotencyHeaders('closure') },
      )
      .pipe(map(({ data }) => data));
  }

  private idempotencyHeaders(operation: string): HttpHeaders {
    return new HttpHeaders({ 'Idempotency-Key': `web-cash-${operation}:${crypto.randomUUID()}` });
  }
}
