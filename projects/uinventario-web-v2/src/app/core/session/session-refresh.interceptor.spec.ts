import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiClient } from '../api/api-client';
import { apiContextInterceptor } from '../api/api-context.interceptor';
import { ApiError } from '../api/api-error';
import { apiResilienceInterceptor } from '../api/api-resilience.interceptor';
import { API_BASE_URL } from '../api/api-runtime-config';
import { SessionManager } from './session-manager';
import { SessionData } from './session.models';
import { sessionRefreshInterceptor } from './session-refresh.interceptor';

describe('sessionRefreshInterceptor', () => {
  const session = { nextStep: 'APPLICATION' } as SessionData;
  const manager = {
    refreshOnce: vi.fn(() => of(session)),
    expire: vi.fn(),
  };
  let api: ApiClient;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.clearAllMocks();
    manager.refreshOnce.mockImplementation(() => of(session));
    TestBed.configureTestingModule({
      providers: [
        { provide: API_BASE_URL, useValue: '/api/v1' },
        { provide: SessionManager, useValue: manager },
        provideHttpClient(
          withInterceptors([
            apiContextInterceptor,
            sessionRefreshInterceptor,
            apiResilienceInterceptor,
          ]),
        ),
        provideHttpClientTesting(),
      ],
    });
    api = TestBed.inject(ApiClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('refreshes once and retries the rejected protected request', () => {
    let result: unknown;
    api.get('/products').subscribe((value) => (result = value));
    http.expectOne('/api/v1/products').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(manager.refreshOnce).toHaveBeenCalledTimes(1);
    http.expectOne('/api/v1/products').flush({ data: ['Producto'] });
    expect(result).toEqual({ data: ['Producto'] });
  });

  it('never intercepts authentication endpoints', () => {
    let receivedError: ApiError | undefined;
    api.get('/auth/sessions/current').subscribe({
      error: (error: ApiError) => (receivedError = error),
    });
    http
      .expectOne('/api/v1/auth/sessions/current')
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(manager.refreshOnce).not.toHaveBeenCalled();
    expect(receivedError?.kind).toBe('unauthenticated');
  });

  it('expires locally without a refresh loop when rotation is rejected', () => {
    manager.refreshOnce.mockImplementation(() =>
      throwError(
        () =>
          new ApiError('unauthenticated', 'Sesión terminada', 401, 'SESSION_INVALID', '', false),
      ),
    );
    api.get('/products').subscribe({ error: () => undefined });
    http.expectOne('/api/v1/products').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(manager.refreshOnce).toHaveBeenCalledTimes(1);
    expect(manager.expire).toHaveBeenCalledTimes(1);
    http.expectNone('/api/v1/products');
  });
});
