import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { catchError, retry, throwError, timeout, timer } from 'rxjs';
import { normalizeApiError } from './api-error';
import { API_RETRY_LIMIT, API_TIMEOUT_MS } from './api-http-context';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const TRANSIENT_STATUSES = new Set([0, 502, 503, 504]);

export const apiResilienceInterceptor: HttpInterceptorFn = (request, next) => {
  const requestId = request.headers.get('X-Request-Id') ?? 'missing-request-id';
  const retryLimit = clamp(request.context.get(API_RETRY_LIMIT), 0, 2);
  const timeoutMs = clamp(request.context.get(API_TIMEOUT_MS), 1, 120_000);

  return next(request).pipe(
    timeout({ each: timeoutMs }),
    retry({
      count: retryLimit,
      delay: (error, retryCount) =>
        canRetry(request, error)
          ? timer(Math.min(100 * 2 ** (retryCount - 1), 500))
          : throwError(() => error),
    }),
    catchError((error: unknown) => throwError(() => normalizeApiError(error, requestId))),
  );
};

export function canRetry(request: HttpRequest<unknown>, error: unknown): boolean {
  const transportIsTransient =
    error instanceof HttpErrorResponse && TRANSIENT_STATUSES.has(error.status);
  if (!transportIsTransient) return false;
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true;
  return Boolean(request.headers.get('Idempotency-Key')?.trim());
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
