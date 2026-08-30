import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_BASE_URL } from './api-runtime-config';
import { ApiRequestContext } from './api-request-context';

export const apiContextInterceptor: HttpInterceptorFn = (request, next) => {
  const apiBaseUrl = inject(API_BASE_URL);
  if (!belongsToApi(request.url, apiBaseUrl)) return next(request);

  const context = inject(ApiRequestContext);
  let headers = request.headers.set('X-Request-Id', context.createCorrelationId());
  const tenantId = context.tenantId();
  if (tenantId) headers = headers.set('X-Tenant-Id', tenantId);

  return next(request.clone({ headers, withCredentials: true }));
};

export function belongsToApi(url: string, apiBaseUrl: string): boolean {
  const base = apiBaseUrl.replace(/\/$/, '');
  return url === base || url.startsWith(`${base}/`) || url.startsWith(`${base}?`);
}
