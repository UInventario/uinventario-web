import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { OfflineBootstrapApiService } from './offline-bootstrap-api.service';
import { OfflineBootstrapPanelComponent } from './offline-bootstrap-panel.component';
import { OfflineStorageError, OfflineStoreService } from './offline-store.service';
import { SessionApiService } from '../auth/session-api.service';

describe('OfflineBootstrapPanelComponent', () => {
  let fixture: ComponentFixture<OfflineBootstrapPanelComponent>;
  const api = { page: vi.fn() };
  const store = {
    deviceId: vi.fn(),
    summary: vi.fn(),
    replaceBootstrap: vi.fn(),
  };
  const scope = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    deviceId: 'device-1',
    branchId: 'branch-1',
    cashRegisterId: null,
  };

  beforeEach(async () => {
    api.page.mockReset();
    store.deviceId.mockReset().mockResolvedValue('10000000-0000-4000-8000-000000000001');
    store.summary.mockReset().mockResolvedValue(null);
    store.replaceBootstrap.mockReset().mockResolvedValue(undefined);
    await TestBed.configureTestingModule({
      imports: [OfflineBootstrapPanelComponent],
      providers: [
        { provide: OfflineBootstrapApiService, useValue: api },
        { provide: OfflineStoreService, useValue: store },
        { provide: SessionApiService, useValue: { session: () => null } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(OfflineBootstrapPanelComponent);
  });

  it('downloads every resumable page and reports the authorized entity count', async () => {
    api.page
      .mockReturnValueOnce(
        of({
          data: {
            protocolVersion: '1.0',
            generatedAt: '2026-08-27T20:00:00.000Z',
            scope,
            page: {
              initialSyncCursor: 'initial',
              cursor: 'first',
              nextCursor: 'next',
              complete: false,
              entities: [
                { kind: 'BRANCH', id: '1' },
                { kind: 'PRODUCT', id: '2' },
              ],
            },
          },
        }),
      )
      .mockReturnValueOnce(
        of({
          data: {
            protocolVersion: '1.0',
            generatedAt: '2026-08-27T20:00:00.000Z',
            scope,
            page: {
              initialSyncCursor: 'initial',
              cursor: 'next',
              nextCursor: null,
              complete: true,
              entities: [{ kind: 'INVENTORY_AVAILABILITY', id: '3' }],
            },
          },
        }),
      );

    const component = fixture.componentInstance as unknown as {
      prepare(): Promise<void>;
      downloaded(): number;
      result(): { entities: number; restored: boolean } | null;
      error(): string | null;
    };
    await component.prepare();
    fixture.detectChanges();

    expect(api.page).toHaveBeenCalledTimes(2);
    expect(api.page.mock.calls[1][1]).toBe('next');
    expect(component.downloaded()).toBe(3);
    expect(store.replaceBootstrap).toHaveBeenCalledOnce();
    expect(component.result()).toEqual(expect.objectContaining({ entities: 3, restored: false }));
    expect(component.error()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Bootstrap guardado: 3 registros');
  });

  it('keeps online fallback visible when the browser quota is exhausted', async () => {
    api.page.mockReturnValue(
      of({
        data: {
          protocolVersion: '1.0',
          generatedAt: '2026-08-27T20:00:00.000Z',
          scope,
          page: {
            initialSyncCursor: 'initial',
            cursor: 'first',
            nextCursor: null,
            complete: true,
            entities: [],
          },
        },
      }),
    );
    store.replaceBootstrap.mockRejectedValue(
      new OfflineStorageError(
        'QUOTA',
        'No hay espacio suficiente para guardar datos offline. Puedes seguir trabajando en línea.',
      ),
    );
    const component = fixture.componentInstance as unknown as {
      prepare(): Promise<void>;
      error(): string | null;
    };

    await component.prepare();

    expect(component.error()).toContain('seguir trabajando en línea');
  });
});
