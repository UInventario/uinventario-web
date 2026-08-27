import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RuntimeConfigService } from '../core/runtime-config.service';
import { OfflineStoreService } from '../offline/offline-store.service';
import { SessionApiService } from './session-api.service';

describe('SessionApiService offline cleanup', () => {
  it('clears persisted offline data even when the logout response fails', async () => {
    const offlineStore = { clearAll: vi.fn().mockResolvedValue(undefined) };
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
  });
});
