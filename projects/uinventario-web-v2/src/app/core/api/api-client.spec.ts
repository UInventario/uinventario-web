import {
  HttpClient,
  HttpContext,
  HttpHeaders,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiClient } from './api-client';
import { apiContextInterceptor } from './api-context.interceptor';
import { ApiError } from './api-error';
import { API_RETRY_LIMIT, API_TIMEOUT_MS } from './api-http-context';
import { ApiRequestContext } from './api-request-context';
import { apiResilienceInterceptor } from './api-resilience.interceptor';
import { API_BASE_URL } from './api-runtime-config';

describe('ApiClient and interceptors', () => {
  let api: ApiClient;
  let context: ApiRequestContext;
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: API_BASE_URL, useValue: '/api/v1' },
        provideHttpClient(withInterceptors([apiContextInterceptor, apiResilienceInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    api = TestBed.inject(ApiClient);
    context = TestBed.inject(ApiRequestContext);
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    context.clearTenant();
  });

  afterEach(() => {
    controller.verify({ ignoreCancelled: true });
    vi.useRealTimers();
  });

  it('sends credentials, tenant and a safe correlation ID only to the configured API', () => {
    context.setTenantFromSession('tenant-1');
    api.get<{ data: string }>('/products').subscribe();

    const request = controller.expectOne('/api/v1/products');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get('X-Tenant-Id')).toBe('tenant-1');
    expect(request.request.headers.get('X-Request-Id')).toMatch(/^web:[\w-]{36}$/);
    request.flush({ data: 'ok' });

    http.get('https://external.example.test/resource').subscribe();
    const external = controller.expectOne('https://external.example.test/resource');
    expect(external.request.withCredentials).toBe(false);
    expect(external.request.headers.has('X-Tenant-Id')).toBe(false);
    expect(external.request.headers.has('X-Request-Id')).toBe(false);
    external.flush({});
  });

  it('rejects invalid tenant context and absolute client paths', () => {
    expect(() => context.setTenantFromSession('tenant id with spaces')).toThrow(/tenant/);
    expect(() => api.get('https://external.example.test')).toThrow(/relativas/);
  });

  it('supports typed PUT contracts required by onboarding and catalog operations', () => {
    api
      .put<{ data: { configured: boolean } }, { name: string }>('/onboarding/company', {
        name: 'Tienda',
      })
      .subscribe((response) => expect(response.data.configured).toBe(true));

    const request = controller.expectOne('/api/v1/onboarding/company');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ name: 'Tienda' });
    request.flush({ data: { configured: true } });
  });

  it('retries a safe read once while preserving its correlation ID', async () => {
    vi.useFakeTimers();
    let response: { data: string } | undefined;
    api.get<{ data: string }>('/products').subscribe((value) => (response = value));

    const first = controller.expectOne('/api/v1/products');
    const requestId = first.request.headers.get('X-Request-Id');
    first.flush({}, { status: 503, statusText: 'Unavailable' });
    await vi.advanceTimersByTimeAsync(100);

    const retryRequest = controller.expectOne('/api/v1/products');
    expect(retryRequest.request.headers.get('X-Request-Id')).toBe(requestId);
    retryRequest.flush({ data: 'ready' });
    expect(response).toEqual({ data: 'ready' });
  });

  it('does not retry a mutation without an idempotency key', () => {
    let receivedError: ApiError | undefined;
    api.post('/products', { name: 'Producto' }).subscribe({
      error: (error: ApiError) => (receivedError = error),
    });

    controller.expectOne('/api/v1/products').flush({}, { status: 503, statusText: 'Unavailable' });
    controller.expectNone('/api/v1/products');
    expect(receivedError).toMatchObject({ kind: 'server', retryable: true });
  });

  it('can retry a mutation when the caller supplies an idempotency key', async () => {
    vi.useFakeTimers();
    api
      .post(
        '/products',
        { name: 'Producto' },
        {
          headers: new HttpHeaders({ 'Idempotency-Key': 'product-create-1' }),
        },
      )
      .subscribe();

    controller.expectOne('/api/v1/products').flush({}, { status: 503, statusText: 'Unavailable' });
    await vi.advanceTimersByTimeAsync(100);
    controller.expectOne('/api/v1/products').flush({ data: 'created' });
  });

  it('cancels a timed-out request and returns a normalized timeout', async () => {
    vi.useFakeTimers();
    let receivedError: ApiError | undefined;
    const requestContext = new HttpContext().set(API_TIMEOUT_MS, 10).set(API_RETRY_LIMIT, 0);
    api.get('/slow', { context: requestContext }).subscribe({
      error: (error: ApiError) => (receivedError = error),
    });

    const request = controller.expectOne('/api/v1/slow');
    await vi.advanceTimersByTimeAsync(11);
    expect(request.cancelled).toBe(true);
    expect(receivedError).toMatchObject({ kind: 'timeout', retryable: true });
  });
});
