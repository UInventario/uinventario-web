import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NotificationApiService } from './notification-api.service';
import { NotificationPanelComponent } from './notification-panel.component';

describe('NotificationPanelComponent', () => {
  let fixture: ComponentFixture<NotificationPanelComponent>;
  let api: {
    refresh: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    markRead: ReturnType<typeof vi.fn>;
    markAllRead: ReturnType<typeof vi.fn>;
    preferences: ReturnType<typeof vi.fn>;
    replacePreferences: ReturnType<typeof vi.fn>;
    deliveries: ReturnType<typeof vi.fn>;
    retryDeliveries: ReturnType<typeof vi.fn>;
  };

  const preference = {
    id: 'preference-1',
    recipient: { id: 'user-1', email: 'admin@example.com' },
    eventType: 'STOCK_LOW' as const,
    enabled: true,
    channels: { inApp: true, email: true, push: false },
    frequency: 'IMMEDIATE' as const,
    updatedAt: '2026-08-29T12:00:00.000Z',
  };

  beforeEach(async () => {
    api = {
      refresh: vi.fn().mockReturnValue(
        of({
          data: {
            reconciliation: { created: 1, deduplicated: 0 },
            delivery: { sent: 1, failed: 0 },
          },
          meta: { apiVersion: '1' },
        }),
      ),
      list: vi.fn().mockReturnValue(
        of({
          data: [
            {
              id: 'notification-1',
              eventType: 'STOCK_LOW',
              title: 'Stock agotado',
              body: 'El producto Café no tiene existencias.',
              severity: 'CRITICAL',
              digestCount: 1,
              sourceOccurredAt: '2026-08-29T12:00:00.000Z',
              readAt: null,
              createdAt: '2026-08-29T12:00:00.000Z',
            },
          ],
          meta: {
            apiVersion: '1',
            unread: 1,
            pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
          },
        }),
      ),
      markRead: vi
        .fn()
        .mockReturnValue(
          of({ data: { id: 'notification-1', read: true }, meta: { apiVersion: '1' } }),
        ),
      markAllRead: vi.fn().mockReturnValue(of({ data: { changed: 1 }, meta: { apiVersion: '1' } })),
      preferences: vi.fn().mockReturnValue(
        of({
          data: {
            preferences: [preference],
            recipients: [{ id: 'user-1', email: 'admin@example.com' }],
          },
          meta: { apiVersion: '1', eventTypes: ['STOCK_LOW'], adapters: {} },
        }),
      ),
      replacePreferences: vi
        .fn()
        .mockReturnValue(of({ data: [preference], meta: { apiVersion: '1' } })),
      deliveries: vi.fn().mockReturnValue(
        of({
          data: [
            {
              id: 'delivery-1',
              notificationId: 'notification-1',
              recipient: { id: 'user-1', email: 'admin@example.com' },
              eventType: 'STOCK_LOW',
              title: 'Stock agotado',
              channel: 'EMAIL',
              adapter: 'SIMULATOR',
              status: 'FAILED',
              attemptCount: 2,
              nextAttemptAt: '2026-08-29T12:05:00.000Z',
              errorCode: 'PROVIDER_UNAVAILABLE',
              deliveredAt: null,
            },
          ],
          meta: { apiVersion: '1' },
        }),
      ),
      retryDeliveries: vi
        .fn()
        .mockReturnValue(of({ data: { sent: 1, failed: 0 }, meta: { apiVersion: '1' } })),
    };

    await TestBed.configureTestingModule({
      imports: [NotificationPanelComponent],
      providers: [{ provide: NotificationApiService, useValue: api }],
    }).compileComponents();
  });

  it('shows the authorized inbox, preferences and observable deliveries', async () => {
    fixture = TestBed.createComponent(NotificationPanelComponent);
    fixture.componentRef.setInput('canManage', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('1 sin leer');
    expect(text).toContain('Stock agotado');
    expect(text).toContain('admin@example.com');
    expect(text).toContain('Fallida · intento 2/5');
    expect(text).toContain('PROVIDER_UNAVAILABLE');
    expect(api.refresh).toHaveBeenCalledOnce();
    expect(api.preferences).toHaveBeenCalledOnce();
  });

  it('marks a notification as read and persists tenant rules', async () => {
    fixture = TestBed.createComponent(NotificationPanelComponent);
    fixture.componentRef.setInput('canManage', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const buttons = [...fixture.nativeElement.querySelectorAll('button')] as HTMLButtonElement[];
    buttons.find((button) => button.textContent?.includes('Marcar leída'))?.click();
    buttons.find((button) => button.textContent?.includes('Guardar reglas'))?.click();
    fixture.detectChanges();

    expect(api.markRead).toHaveBeenCalledWith('notification-1');
    expect(api.replacePreferences).toHaveBeenCalledWith([
      {
        recipientUserId: 'user-1',
        eventType: 'STOCK_LOW',
        enabled: true,
        inApp: true,
        email: true,
        push: false,
        frequency: 'IMMEDIATE',
      },
    ]);
  });
});
