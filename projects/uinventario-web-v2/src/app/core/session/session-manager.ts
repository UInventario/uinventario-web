import { Injectable, OnDestroy, inject } from '@angular/core';
import {
  Observable,
  catchError,
  finalize,
  from,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { ApiError } from '../api/api-error';
import { DesktopPeripheralPort } from '../desktop/desktop-peripheral.port';
import { OfflineStore } from '../offline/offline-store';
import { OfflineSessionSnapshot } from '../offline/offline.models';
import { SessionApi } from './session-api';
import { SessionContextInput, SessionData, SessionResponse } from './session.models';
import { SessionNavigation } from './session-navigation';
import { SessionState } from './session-state';

type SessionEvent = 'SESSION_CLOSED' | 'SESSION_ROTATED';

@Injectable({ providedIn: 'root' })
export class SessionManager implements OnDestroy {
  private readonly api = inject(SessionApi);
  private readonly navigation = inject(SessionNavigation);
  private readonly state = inject(SessionState);
  private readonly offline = inject(OfflineStore);
  private readonly desktop = inject(DesktopPeripheralPort);
  private readonly channel =
    typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('uinventario-v2-session');
  private restoreInFlight?: Observable<SessionData>;
  private refreshInFlight?: Observable<SessionData>;
  private renewalTimer?: ReturnType<typeof setTimeout>;
  private lifecycleRevision = 0;

  constructor() {
    this.channel?.addEventListener('message', ({ data }: MessageEvent<SessionEvent>) => {
      if (data === 'SESSION_CLOSED') this.closeLocal(false, true);
      if (data === 'SESSION_ROTATED') this.reconcileAfterRemoteRotation();
    });
  }

  ngOnDestroy(): void {
    this.cancelRenewal();
    this.channel?.close();
  }

  login(email: string, password: string): Observable<SessionData> {
    return this.api
      .login({ email: email.trim().toLowerCase(), password })
      .pipe(map((response) => this.accept(response)));
  }

  restore(): Observable<SessionData> {
    const existing = this.state.session();
    if (existing) return of(existing);
    if (this.restoreInFlight) return this.restoreInFlight;

    const request = this.api.current().pipe(
      map((response) => this.accept(response)),
      catchError((error: unknown) => {
        if (isAuthenticationRejection(error)) this.closeLocal(false, false);
        if (isConnectivityFailure(error)) {
          return from(this.offline.restoreSession()).pipe(
            switchMap((snapshot) =>
              snapshot ? of(this.acceptOffline(snapshot)) : throwError(() => error),
            ),
          );
        }
        return throwError(() => error);
      }),
      finalize(() => {
        if (this.restoreInFlight === request) this.restoreInFlight = undefined;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.restoreInFlight = request;
    return request;
  }

  refreshOnce(broadcast = false): Observable<SessionData> {
    if (this.refreshInFlight) return this.refreshInFlight;

    const request = this.api.refresh().pipe(
      map((response) => this.accept(response)),
      tap(() => {
        if (broadcast) this.channel?.postMessage('SESSION_ROTATED' satisfies SessionEvent);
      }),
      finalize(() => {
        if (this.refreshInFlight === request) this.refreshInFlight = undefined;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.refreshInFlight = request;
    return request;
  }

  changeContext(input: SessionContextInput): Observable<SessionData> {
    this.cancelRenewal();
    const revision = this.lifecycleRevision;
    const pendingRefresh = this.refreshInFlight
      ? this.refreshInFlight.pipe(map(() => undefined))
      : of(undefined);
    return pendingRefresh.pipe(
      switchMap(() => this.api.changeContext(input)),
      map((response) => {
        if (revision !== this.lifecycleRevision) {
          throw new Error('La sesión cambió mientras se actualizaba el contexto.');
        }
        return this.state.accept(response);
      }),
      tap(() => this.channel?.postMessage('SESSION_ROTATED' satisfies SessionEvent)),
      finalize(() => this.scheduleRenewal()),
    );
  }

  logout(): Observable<void> {
    return this.api.logout().pipe(finalize(() => this.closeLocal(true, true, false)));
  }

  expire(returnUrl?: string): void {
    this.closeLocal(true, true, true, returnUrl);
  }

  private accept(response: SessionResponse): SessionData {
    const session = this.state.accept(response);
    this.scheduleRenewal();
    return session;
  }

  private acceptOffline(snapshot: OfflineSessionSnapshot): SessionData {
    return this.accept({
      data: snapshot.session,
      meta: { apiVersion: '1', sessionExpiresAt: snapshot.sessionExpiresAt },
    });
  }

  private scheduleRenewal(): void {
    this.cancelRenewal();
    const expiresAt = this.state.expiresAt();
    if (expiresAt === null) return;
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      this.expire();
      return;
    }

    const lead = Math.min(5 * 60_000, Math.max(1_000, remaining / 4));
    this.renewalTimer = setTimeout(
      () => {
        this.refreshOnce(true).subscribe({
          error: (error: unknown) => {
            if (isAuthenticationRejection(error)) this.expire();
            else this.scheduleRecoveryAttempt();
          },
        });
      },
      Math.max(0, remaining - lead),
    );
  }

  private scheduleRecoveryAttempt(): void {
    this.cancelRenewal();
    const remaining = (this.state.expiresAt() ?? 0) - Date.now();
    if (remaining <= 1_000) {
      this.expire();
      return;
    }
    this.renewalTimer = setTimeout(
      () => this.scheduleRenewal(),
      Math.min(30_000, remaining - 1_000),
    );
  }

  private reconcileAfterRemoteRotation(): void {
    this.cancelRenewal();
    setTimeout(() => {
      this.api.current().subscribe({
        next: (response) => this.accept(response),
        error: (error: unknown) => {
          if (isAuthenticationRejection(error)) this.closeLocal(false, true);
        },
      });
    }, 100);
  }

  private closeLocal(
    broadcast: boolean,
    navigate: boolean,
    preserveReturnUrl = true,
    returnUrl?: string,
  ): void {
    this.lifecycleRevision += 1;
    this.cancelRenewal();
    this.restoreInFlight = undefined;
    this.refreshInFlight = undefined;
    this.state.clear();
    this.desktop.notifySessionClosed();
    void this.offline.clearAll().catch(() => undefined);
    if (broadcast) this.channel?.postMessage('SESSION_CLOSED' satisfies SessionEvent);
    if (navigate) {
      this.navigation.redirectToLogin(returnUrl ?? null, preserveReturnUrl);
    }
  }

  private cancelRenewal(): void {
    if (this.renewalTimer !== undefined) clearTimeout(this.renewalTimer);
    this.renewalTimer = undefined;
  }
}

export function isAuthenticationRejection(error: unknown): boolean {
  return error instanceof ApiError && error.kind === 'unauthenticated';
}

function isConnectivityFailure(error: unknown): boolean {
  return error instanceof ApiError && ['network', 'timeout'].includes(error.kind);
}
