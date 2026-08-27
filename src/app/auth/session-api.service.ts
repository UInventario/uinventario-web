import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { RuntimeConfigService } from '../core/runtime-config.service';

export interface SessionData {
  user: { id: string; email: string; roles: string[] };
  tenant: { id: string; name: string };
  nextStep: 'ONBOARDING' | 'APPLICATION';
}

export interface SessionResponse {
  data: SessionData;
  meta: { apiVersion: '1' };
}

@Injectable({ providedIn: 'root' })
export class SessionApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  readonly session = signal<SessionData | null>(null);

  login(email: string, password: string) {
    return this.http
      .post<SessionResponse>(
        `${this.config.apiBaseUrl()}/auth/sessions`,
        { email, password },
        { withCredentials: true },
      )
      .pipe(tap(({ data }) => this.session.set(data)));
  }

  loadCurrent() {
    return this.http
      .get<SessionResponse>(`${this.config.apiBaseUrl()}/auth/sessions/current`, {
        withCredentials: true,
      })
      .pipe(tap(({ data }) => this.session.set(data)));
  }
}
