import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';

export interface RegistrationPayload {
  organizationName: string;
  email: string;
  password: string;
}

export interface RegistrationResponse {
  data: {
    tenant: { id: string; name: string };
    user: { id: string; email: string };
    nextStep: 'LOGIN';
  };
  meta: { apiVersion: '1' };
}

@Injectable({ providedIn: 'root' })
export class RegistrationApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  register(payload: RegistrationPayload, idempotencyKey: string) {
    return this.http.post<RegistrationResponse>(
      `${this.config.apiBaseUrl()}/auth/registrations`,
      payload,
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
  }
}
