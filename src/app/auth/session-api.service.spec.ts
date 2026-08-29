import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { RuntimeConfigService } from '../core/runtime-config.service';
import { OfflineStoreService } from '../offline/offline-store.service';
import { SessionApiService } from './session-api.service';

describe('SessionApiService offline cleanup', () => {
  it('clears persisted offline data even when the logout response fails', async () => {
    const offlineStore = { clearAll: vi.fn().mockResolvedValue(undefined) };
    const nativeSessionClosed = vi.fn();
    window.addEventListener('uinventario:session-closed', nativeSessionClosed);
    await TestBed.configureTestingModule({
      providers: [
        SessionApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RuntimeConfigService, useValue: { apiBaseUrl: () => '/api/v1' } },
        { provide: Router, useValue: { url: '/app', navigate: vi.fn() } },
        { provide: OfflineStoreService, useValue: offlineStore },
      ],
    }).compileComponents();
    const service = TestBed.inject(SessionApiService);
    const http = TestBed.inject(HttpTestingController);

    service.logout().subscribe({ error: () => undefined });
    http
      .expectOne('/api/v1/auth/sessions/current')
      .flush({ message: 'network failure' }, { status: 503, statusText: 'Unavailable' });
    await Promise.resolve();

    expect(offlineStore.clearAll).toHaveBeenCalledOnce();
    expect(nativeSessionClosed).toHaveBeenCalledOnce();
    window.removeEventListener('uinventario:session-closed', nativeSessionClosed);
  });

  it('keeps the local session and offline data on a connectivity failure', async () => {
    const offlineStore = {
      clearAll: vi.fn().mockResolvedValue(undefined),
      deviceId: vi.fn().mockResolvedValue('10000000-0000-4000-8000-000000000001'),
      clearIncompatible: vi.fn().mockResolvedValue(undefined),
      saveSession: vi.fn().mockResolvedValue(undefined),
      restoreSession: vi.fn().mockResolvedValue(null),
    };
    await TestBed.configureTestingModule({
      providers: [
        SessionApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RuntimeConfigService, useValue: { apiBaseUrl: () => '/api/v1' } },
        { provide: Router, useValue: { url: '/app', navigate: vi.fn() } },
        { provide: OfflineStoreService, useValue: offlineStore },
      ],
    }).compileComponents();
    const service = TestBed.inject(SessionApiService);
    const http = TestBed.inject(HttpTestingController);
    service.loadCurrent().subscribe();
    http.expectOne('/api/v1/auth/sessions/current').flush({
      data: {
        tenant: { id: 'tenant-1', name: 'Tenant' },
        user: { id: 'user-1', email: 'user@example.com', roles: [], permissions: [] },
        context: { branch: null, warehouse: null, cashRegister: null },
        nextStep: 'APPLICATION',
      },
      meta: {
        apiVersion: '1',
        sessionExpiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
      },
    });
    service.loadCurrent().subscribe({ error: () => undefined });
    http
      .expectOne('/api/v1/auth/sessions/current')
      .error(new ProgressEvent('network'), { status: 0, statusText: 'Unknown Error' });

    expect(service.session()?.user.id).toBe('user-1');
    expect(offlineStore.clearAll).not.toHaveBeenCalled();
  });

  it('restores a prepared session snapshot when the API is unreachable', async () => {
    const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString();
    const session = {
      tenant: { id: 'tenant-1', name: 'Tenant' },
      user: { id: 'user-1', email: 'user@example.com', roles: ['ADMIN'], permissions: [] },
      context: {
        branch: { id: 'branch-1', name: 'Principal' },
        warehouse: { id: 'warehouse-1', name: 'General' },
        cashRegister: null,
      },
      nextStep: 'APPLICATION' as const,
    };
    const offlineStore = {
      clearAll: vi.fn().mockResolvedValue(undefined),
      restoreSession: vi.fn().mockResolvedValue({ session, sessionExpiresAt: expiresAt }),
    };
    await TestBed.configureTestingModule({
      providers: [
        SessionApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RuntimeConfigService, useValue: { apiBaseUrl: () => '/api/v1' } },
        { provide: Router, useValue: { url: '/app', navigate: vi.fn() } },
        { provide: OfflineStoreService, useValue: offlineStore },
      ],
    }).compileComponents();
    const service = TestBed.inject(SessionApiService);
    const http = TestBed.inject(HttpTestingController);

    const restored = firstValueFrom(service.loadCurrent());
    http
      .expectOne('/api/v1/auth/sessions/current')
      .error(new ProgressEvent('network'), { status: 0, statusText: 'Unknown Error' });

    await expect(restored).resolves.toEqual({
      data: session,
      meta: { apiVersion: '1', sessionExpiresAt: expiresAt },
    });
    expect(service.session()).toEqual(session);
  });
});
