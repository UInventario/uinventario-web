import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';

interface RequestPasswordResetResponse {
  data: { accepted: true };
  meta: { apiVersion: '1' };
}

interface CompletePasswordResetResponse {
  data: { reset: true };
  meta: { apiVersion: '1' };
}

@Injectable({ providedIn: 'root' })
export class PasswordResetApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  request(email: string) {
    return this.http.post<RequestPasswordResetResponse>(
      `${this.config.apiBaseUrl()}/auth/password-resets`,
      { email },
    );
  }

  complete(token: string, password: string) {
    return this.http.post<CompletePasswordResetResponse>(
      `${this.config.apiBaseUrl()}/auth/password-resets/complete`,
      { token, password },
    );
  }
}
