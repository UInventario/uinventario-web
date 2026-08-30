import { HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../../../core/api/api-client';
import { IdentityGateway, RegistrationInput } from '../domain/identity.gateway';
import {
  PasswordResetCompleteResponseDto,
  PasswordResetRequestResponseDto,
  RegistrationRequestDto,
  RegistrationResponseDto,
} from './identity-api.models';

@Injectable()
export class IdentityApi extends IdentityGateway {
  private readonly api = inject(ApiClient);

  override register(payload: RegistrationInput, idempotencyKey: string) {
    return this.api
      .post<RegistrationResponseDto, RegistrationRequestDto>('/auth/registrations', payload, {
        headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
      })
      .pipe(
        map(({ data }) => ({
          tenantId: data.tenant.id,
          tenantName: data.tenant.name,
          userId: data.user.id,
          email: data.user.email,
        })),
      );
  }

  override requestPasswordReset(email: string) {
    return this.api
      .post<PasswordResetRequestResponseDto, { email: string }>('/auth/password-resets', { email })
      .pipe(map(() => undefined));
  }

  override completePasswordReset(token: string, password: string) {
    return this.api
      .post<PasswordResetCompleteResponseDto, { token: string; password: string }>(
        '/auth/password-resets/complete',
        { token, password },
      )
      .pipe(map(() => undefined));
  }
}
