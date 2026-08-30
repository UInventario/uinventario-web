import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiRequestContext } from '../api/api-request-context';
import { SessionApi } from './session-api';
import { SessionManager } from './session-manager';
import { SessionResponse } from './session.models';
import { SessionNavigation } from './session-navigation';
import { SessionState } from './session-state';

describe('SessionManager', () => {
  const response = (): SessionResponse => ({
    data: {
      user: {
        id: 'user-1',
        email: 'admin@example.com',
        roles: ['ADMIN'],
        permissions: ['products:read'],
      },
      tenant: { id: 'tenant-1', name: 'Tienda Central' },
      context: {
        branch: { id: 'branch-1', name: 'Principal' },
        warehouse: { id: 'warehouse-1', name: 'Bodega' },
        cashRegister: { id: 'register-1', name: 'Caja', code: 'CAJA-1' },
      },
      nextStep: 'APPLICATION',
    },
    meta: { apiVersion: '1', sessionExpiresAt: new Date(Date.now() + 60 * 60_000).toISOString() },
  });
  const api = {
    login: vi.fn(() => of(response())),
    current: vi.fn(() => of(response())),
    refresh: vi.fn(() => of(response())),
    logout: vi.fn(() => of(undefined)),
  };
  const navigation = {
    redirectToLogin: vi.fn(),
    openAuthorizedWorkspace: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        SessionManager,
        SessionState,
        ApiRequestContext,
        { provide: SessionApi, useValue: api },
        { provide: SessionNavigation, useValue: navigation },
      ],
    });
  });

  afterEach(() => TestBed.inject(SessionManager).expire());

  it('normalizes login identity and keeps only non-sensitive session data in memory', () => {
    const manager = TestBed.inject(SessionManager);
    const state = TestBed.inject(SessionState);
    const context = TestBed.inject(ApiRequestContext);

    manager.login(' Admin@Example.COM ', 'Secret').subscribe();

    expect(api.login).toHaveBeenCalledWith({ email: 'admin@example.com', password: 'Secret' });
    expect(state.session()?.user.email).toBe('admin@example.com');
    expect(context.tenantId()).toBe('tenant-1');
    expect(state.session()).not.toHaveProperty('accessToken');
  });

  it('reuses the accepted session and avoids redundant current-session requests', () => {
    const manager = TestBed.inject(SessionManager);
    manager.restore().subscribe();
    manager.restore().subscribe();
    expect(api.current).toHaveBeenCalledTimes(1);
  });

  it('invalidates the server session and clears local tenant state on logout', () => {
    const manager = TestBed.inject(SessionManager);
    const state = TestBed.inject(SessionState);
    const context = TestBed.inject(ApiRequestContext);
    manager.restore().subscribe();

    manager.logout().subscribe();

    expect(api.logout).toHaveBeenCalledTimes(1);
    expect(state.session()).toBeNull();
    expect(context.tenantId()).toBeNull();
    expect(navigation.redirectToLogin).toHaveBeenCalledWith(null, false);
  });
});
