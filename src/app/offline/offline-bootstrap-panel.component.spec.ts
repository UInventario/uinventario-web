import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { OfflineBootstrapApiService } from './offline-bootstrap-api.service';
import { OfflineBootstrapPanelComponent } from './offline-bootstrap-panel.component';

describe('OfflineBootstrapPanelComponent', () => {
  let fixture: ComponentFixture<OfflineBootstrapPanelComponent>;
  const api = { page: vi.fn() };
  const scope = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    deviceId: 'device-1',
    branchId: 'branch-1',
    cashRegisterId: null,
  };

  beforeEach(async () => {
    api.page.mockReset();
    await TestBed.configureTestingModule({
      imports: [OfflineBootstrapPanelComponent],
      providers: [{ provide: OfflineBootstrapApiService, useValue: api }],
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
      result(): { entities: number } | null;
      error(): string | null;
    };
    await component.prepare();
    fixture.detectChanges();

    expect(api.page).toHaveBeenCalledTimes(2);
    expect(api.page.mock.calls[1][1]).toBe('next');
    expect(component.downloaded()).toBe(3);
    expect(component.result()).toEqual(expect.objectContaining({ entities: 3 }));
    expect(component.error()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Bootstrap completo: 3 registros');
  });
});
