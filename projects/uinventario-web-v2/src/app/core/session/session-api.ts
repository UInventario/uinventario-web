import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../api/api-client';
import { LoginInput, SessionContextInput, SessionResponse } from './session.models';

@Injectable({ providedIn: 'root' })
export class SessionApi {
  private readonly api = inject(ApiClient);

  login(input: LoginInput) {
    return this.api.post<SessionResponse, LoginInput>('/auth/sessions', input);
  }

  current() {
    return this.api.get<SessionResponse>('/auth/sessions/current');
  }

  refresh() {
    return this.api.post<SessionResponse, Record<string, never>>('/auth/sessions/refresh', {});
  }

  changeContext(input: SessionContextInput) {
    return this.api.patch<SessionResponse, SessionContextInput>(
      '/auth/sessions/current/context',
      input,
    );
  }

  logout() {
    return this.api.delete<void>('/auth/sessions/current');
  }
}
