import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { belongsToApi } from '../api/api-context.interceptor';
import { ApiError } from '../api/api-error';
import { API_BASE_URL } from '../api/api-runtime-config';
import { SessionManager } from './session-manager';

export const sessionRefreshInterceptor: HttpInterceptorFn = (request, next) => {
  const apiBaseUrl = inject(API_BASE_URL);
  if (!belongsToApi(request.url, apiBaseUrl) || isAuthenticationRequest(request.url, apiBaseUrl)) {
    return next(request);
  }

  const manager = inject(SessionManager);
  return next(request).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof ApiError) || error.kind !== 'unauthenticated') {
        return throwError(() => error);
      }
      return manager.refreshOnce(true).pipe(
        switchMap(() => next(request)),
        catchError((refreshError: unknown) => {
          manager.expire();
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};

function isAuthenticationRequest(url: string, apiBaseUrl: string): boolean {
  const base = apiBaseUrl.replace(/\/$/, '');
  return url.startsWith(`${base}/auth/`);
}
