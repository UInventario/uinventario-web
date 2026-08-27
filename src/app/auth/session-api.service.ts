import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, tap, throwError } from 'rxjs';
import { RuntimeConfigService } from '../core/runtime-config.service';

export interface SessionData {
  user: { id: string; email: string; roles: string[]; permissions: string[] };
  tenant: { id: string; name: string };
  context: {
    branch: { id: string; name: string } | null;
    warehouse: { id: string; name: string } | null;
    cashRegister: { id: string; name: string; code: string } | null;
  };
  nextStep: 'ONBOARDING' | 'APPLICATION';
}

export interface SessionResponse {
  data: SessionData;
  meta: { apiVersion: '1'; sessionExpiresAt: string };
}

type SessionEvent = 'SESSION_CLOSED' | 'SESSION_ROTATED';

@Injectable({ providedIn: 'root' })
export class SessionApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);
  private readonly router = inject(Router);
  private readonly channel =
    typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('uinventario-session');
  private renewalTimer: ReturnType<typeof setTimeout> | undefined;

  readonly session = signal<SessionData | null>(null);

  constructor() {
    this.channel?.addEventListener('message', ({ data }: MessageEvent<SessionEvent>) => {
      if (data === 'SESSION_CLOSED') {
        this.closeLocalSession(false);
      } else if (data === 'SESSION_ROTATED') {
        this.cancelRenewal();
        setTimeout(() => this.reconcileSession(), 100);
      }
    });
  }

  login(email: string, password: string) {
    return this.http
      .post<SessionResponse>(
        `${this.config.apiBaseUrl()}/auth/sessions`,
        { email, password },
        { withCredentials: true },
      )
      .pipe(tap((response) => this.acceptSession(response)));
  }

  loadCurrent() {
    return this.http
      .get<SessionResponse>(`${this.config.apiBaseUrl()}/auth/sessions/current`, {
        withCredentials: true,
      })
      .pipe(
        tap((response) => this.acceptSession(response)),
        catchError((error: unknown) => {
          this.clearLocalState();
          return throwError(() => error);
        }),
      );
  }

  refresh() {
    return this.http
      .post<SessionResponse>(
        `${this.config.apiBaseUrl()}/auth/sessions/refresh`,
        {},
        { withCredentials: true },
      )
      .pipe(
        tap((response) => {
          this.acceptSession(response);
          this.channel?.postMessage('SESSION_ROTATED' satisfies SessionEvent);
        }),
      );
  }

  changeContext(branchId: string, warehouseId: string) {
    return this.http
      .patch<SessionResponse>(
        `${this.config.apiBaseUrl()}/auth/sessions/current/context`,
        { branchId, warehouseId },
        { withCredentials: true },
      )
      .pipe(tap((response) => this.acceptSession(response)));
  }

  logout() {
    return this.http
      .delete<void>(`${this.config.apiBaseUrl()}/auth/sessions/current`, {
        withCredentials: true,
      })
      .pipe(finalize(() => this.closeLocalSession(true)));
  }

  private acceptSession(response: SessionResponse): void {
    this.session.set(response.data);
    this.scheduleRenewal(response.meta.sessionExpiresAt);
  }

  private scheduleRenewal(expiresAtValue: string): void {
    this.cancelRenewal();
    const remaining = new Date(expiresAtValue).getTime() - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) {
      this.closeLocalSession(false);
      return;
    }

    const renewalLead = Math.min(5 * 60_000, Math.max(1_000, remaining / 4));
    this.renewalTimer = setTimeout(
      () => this.refreshInBackground(),
      Math.max(0, remaining - renewalLead),
    );
  }

  private refreshInBackground(): void {
    this.refresh().subscribe({
      error: () => setTimeout(() => this.reconcileSession(), 250),
    });
  }

  private reconcileSession(): void {
    this.loadCurrent().subscribe({
      error: () => this.closeLocalSession(false),
    });
  }

  private cancelRenewal(): void {
    if (this.renewalTimer !== undefined) {
      clearTimeout(this.renewalTimer);
      this.renewalTimer = undefined;
    }
  }

  private closeLocalSession(broadcast: boolean): void {
    this.clearLocalState();
    if (broadcast) {
      this.channel?.postMessage('SESSION_CLOSED' satisfies SessionEvent);
    }
    if (this.router.url !== '/login') {
      void this.router.navigate(['/login']);
    }
  }

  private clearLocalState(): void {
    this.cancelRenewal();
    this.session.set(null);
  }
}
