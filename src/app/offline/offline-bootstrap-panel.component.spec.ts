import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { OfflineBootstrapApiService } from './offline-bootstrap-api.service';
import { OfflineBootstrapPanelComponent } from './offline-bootstrap-panel.component';
import { OfflineStorageError, OfflineStoreService } from './offline-store.service';
import { SessionApiService } from '../auth/session-api.service';

describe('OfflineBootstrapPanelComponent', () => {
  let fixture: ComponentFixture<OfflineBootstrapPanelComponent>;
  const api = { page: vi.fn() };
  let currentSession: unknown = null;
  const store = {
    deviceId: vi.fn(),
    summary: vi.fn(),
    replaceBootstrap: vi.fn(),
    applyChanges: vi.fn(),
  };
  const scope = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    deviceId: '10000000-0000-4000-8000-000000000001',
    branchId: 'branch-1',
    cashRegisterId: null,
  };

  beforeEach(async () => {
    api.page.mockReset();
    Object.assign(api, { changes: vi.fn() });
    currentSession = null;
    store.deviceId.mockReset().mockResolvedValue('10000000-0000-4000-8000-000000000001');
    store.summary.mockReset().mockResolvedValue(null);
    store.replaceBootstrap.mockReset().mockResolvedValue(undefined);
    store.applyChanges.mockReset().mockResolvedValue(undefined);
    await TestBed.configureTestingModule({
      imports: [OfflineBootstrapPanelComponent],
      providers: [
        { provide: OfflineBootstrapApiService, useValue: api },
        { provide: OfflineStoreService, useValue: store },
        { provide: SessionApiService, useValue: { session: () => currentSession } },
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

  it('applies every incremental page before advancing its cursor', async () => {
    currentSession = {
      tenant: { id: 'tenant-1' },
      user: { id: 'user-1' },
      context: { branch: { id: 'branch-1' }, cashRegister: null },
    };
    store.summary
      .mockResolvedValueOnce({
        entities: 2,
        generatedAt: '2026-08-27T20:00:00.000Z',
        storedAt: '2026-08-27T20:00:00.000Z',
        cursor: 'cursor-0',
      })
      .mockResolvedValueOnce({
        entities: 3,
        generatedAt: '2026-08-27T20:01:00.000Z',
        storedAt: '2026-08-27T20:01:00.000Z',
        cursor: 'cursor-2',
      });
    const changes = (api as typeof api & { changes: ReturnType<typeof vi.fn> }).changes;
    changes
      .mockReturnValueOnce(
        of({
          data: {
            scope,
            nextCursor: 'cursor-1',
            hasMore: true,
            changes: [{ operation: 'UPSERT', entity: { kind: 'PRODUCT', id: '3' } }],
          },
        }),
      )
      .mockReturnValueOnce(
        of({ data: { scope, nextCursor: 'cursor-2', hasMore: false, changes: [] } }),
      );
    const component = fixture.componentInstance as unknown as {
      sync(): Promise<void>;
      downloaded(): number;
    };

    await component.sync();

    expect(store.applyChanges.mock.calls.map((call) => call[2])).toEqual(['cursor-1', 'cursor-2']);
    expect(component.downloaded()).toBe(3);
  });
});
