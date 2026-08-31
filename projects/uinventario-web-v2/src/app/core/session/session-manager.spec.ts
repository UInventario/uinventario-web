import { TestBed } from '@angular/core/testing';
import { Subject, firstValueFrom, of, throwError } from 'rxjs';
import { ApiError } from '../api/api-error';
import { ApiRequestContext } from '../api/api-request-context';
import { DesktopPeripheralPort } from '../desktop/desktop-peripheral.port';
import { OfflineSessionSnapshot } from '../offline/offline.models';
import { OfflineStore } from '../offline/offline-store';
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
        permissions: ['PRODUCTS_MANAGE'],
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
    changeContext: vi.fn(() => of(response())),
    logout: vi.fn(() => of(undefined)),
  };
  const navigation = {
    redirectToLogin: vi.fn(),
    openAuthorizedWorkspace: vi.fn(),
  };
  const desktop = { notifySessionClosed: vi.fn() };
  const offline = {
    clearAll: vi.fn(() => Promise.resolve()),
    restoreSession: vi.fn<() => Promise<OfflineSessionSnapshot | null>>(() =>
      Promise.resolve(null),
    ),
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
        { provide: OfflineStore, useValue: offline },
        { provide: DesktopPeripheralPort, useValue: desktop },
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

  it('restores only the non-sensitive authorized snapshot when the network is unavailable', async () => {
    api.current.mockReturnValueOnce(
      throwError(() => new ApiError('network', 'Sin conexión.', 0, 'NETWORK', 'request-1', true)),
    );
    offline.restoreSession.mockResolvedValueOnce({
      session: response().data,
      sessionExpiresAt: response().meta.sessionExpiresAt,
    });

    await expect(firstValueFrom(TestBed.inject(SessionManager).restore())).resolves.toMatchObject({
      user: { email: 'admin@example.com' },
      tenant: { id: 'tenant-1' },
    });
    expect(TestBed.inject(SessionState).session()).not.toHaveProperty('accessToken');
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
    expect(offline.clearAll).toHaveBeenCalled();
    expect(desktop.notifySessionClosed).toHaveBeenCalledOnce();
    expect(navigation.redirectToLogin).toHaveBeenCalledWith(null, false);
  });

  it('accepts a server-validated context change without replacing the session mechanism', () => {
    const manager = TestBed.inject(SessionManager);
    manager.restore().subscribe();

    manager.changeContext({ branchId: 'branch-1', warehouseId: 'warehouse-1' }).subscribe();

    expect(api.changeContext).toHaveBeenCalledWith({
      branchId: 'branch-1',
      warehouseId: 'warehouse-1',
    });
    expect(TestBed.inject(SessionState).session()?.tenant.id).toBe('tenant-1');
  });

  it('does not revive a closed session with a late context response', () => {
    const contextResponse = new Subject<SessionResponse>();
    api.changeContext.mockReturnValueOnce(contextResponse);
    const manager = TestBed.inject(SessionManager);
    const state = TestBed.inject(SessionState);
    manager.restore().subscribe();
    const rejected = vi.fn();
    manager
      .changeContext({ branchId: 'branch-1', warehouseId: 'warehouse-1' })
      .subscribe({ error: rejected });

    manager.expire();
    contextResponse.next(response());
    contextResponse.complete();

    expect(rejected).toHaveBeenCalledOnce();
    expect(state.session()).toBeNull();
  });
});
