import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { AuthorizationService } from '../../../../core/authorization/authorization.service';
import { DashboardFacade } from '../../application/dashboard.facade';
import {
  NOTIFICATION_LABELS,
  notificationDestination,
} from '../../application/notification-presentation';
import {
  NOTIFICATION_EVENT_TYPES,
  NotificationDelivery,
  NotificationEventType,
  NotificationFrequency,
  NotificationItem,
  NotificationPreference,
} from '../../domain/dashboard.models';

type NotificationPanel = 'inbox' | 'settings';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  selector: 'ui-notification-center-page',
  styleUrl: './notification-center-page.scss',
  templateUrl: './notification-center-page.html',
})
export class NotificationCenterPage implements OnInit {
  private readonly api = inject(DashboardFacade);
  private readonly authorization = inject(AuthorizationService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly eventTypes = NOTIFICATION_EVENT_TYPES;
  protected readonly canManage = computed(() => this.authorization.has('NOTIFICATIONS_MANAGE'));
  protected readonly panel = signal<NotificationPanel>('inbox');
  protected readonly filters = this.formBuilder.nonNullable.group({
    type: '',
    unreadOnly: false,
  });
  protected readonly items = signal<readonly NotificationItem[]>([]);
  protected readonly unread = signal(0);
  protected readonly total = signal(0);
  protected readonly preferences = signal<readonly NotificationPreference[]>([]);
  protected readonly recipients = signal<
    readonly { readonly id: string; readonly email: string }[]
  >([]);
  protected readonly deliveries = signal<readonly NotificationDelivery[]>([]);
  protected readonly newRecipientId = signal('');
  protected readonly newEventType = signal<NotificationEventType>('STOCK_LOW');
  protected readonly loading = signal(true);
  protected readonly acting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly destination = notificationDestination;
  protected readonly eventLabel = (type: NotificationEventType) => NOTIFICATION_LABELS[type];

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const requestedPanel = params.get('panel');
      const panel = requestedPanel === 'settings' && this.canManage() ? 'settings' : 'inbox';
      const requestedType = params.get('type');
      const type = NOTIFICATION_EVENT_TYPES.includes(requestedType as NotificationEventType)
        ? (requestedType ?? '')
        : '';
      this.panel.set(panel);
      this.filters.setValue(
        { type, unreadOnly: params.get('unread') === 'true' },
        { emitEvent: false },
      );
      if (panel === 'settings') this.loadManagement();
      else this.loadInbox();
    });
  }

  protected selectPanel(panel: NotificationPanel): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        panel: panel === 'settings' ? 'settings' : null,
        type: null,
        unread: null,
      },
    });
  }

  protected applyFilters(): void {
    const filters = this.filters.getRawValue();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        panel: null,
        type: filters.type || null,
        unread: filters.unreadOnly ? 'true' : null,
      },
    });
  }

  protected refresh(): void {
    if (this.acting()) return;
    this.acting.set(true);
    this.error.set(null);
    this.notice.set(null);
    this.api
      .refreshNotifications()
      .pipe(finalize(() => this.acting.set(false)))
      .subscribe({
        next: () => {
          this.notice.set('Eventos operativos conciliados.');
          this.loadInbox();
        },
        error: (error: unknown) => this.error.set(this.message(error)),
      });
  }

  protected markRead(item: NotificationItem): void {
    if (item.readAt || this.acting()) return;
    this.acting.set(true);
    this.api
      .markNotificationRead(item.id)
      .pipe(finalize(() => this.acting.set(false)))
      .subscribe({
        next: () => this.loadInbox(),
        error: (error: unknown) => this.error.set(this.message(error)),
      });
  }

  protected markAllRead(): void {
    if (!this.unread() || this.acting()) return;
    this.acting.set(true);
    this.api
      .markAllNotificationsRead()
      .pipe(finalize(() => this.acting.set(false)))
      .subscribe({
        next: (changed) => {
          this.notice.set(`${changed} notificación(es) marcadas como leídas.`);
          this.loadInbox();
        },
        error: (error: unknown) => this.error.set(this.message(error)),
      });
  }

  protected addPreference(): void {
    const recipient = this.recipients().find(({ id }) => id === this.newRecipientId());
    if (!recipient) {
      this.error.set('Selecciona un destinatario.');
      return;
    }
    if (
      this.preferences().some(
        (item) => item.recipient.id === recipient.id && item.eventType === this.newEventType(),
      )
    ) {
      this.error.set('Ese destinatario ya tiene una regla para el evento.');
      return;
    }
    this.preferences.update((items) => [
      ...items,
      {
        id: `new:${recipient.id}:${this.newEventType()}`,
        recipient,
        eventType: this.newEventType(),
        enabled: true,
        channels: { inApp: true, email: false, push: false },
        frequency: 'IMMEDIATE',
        updatedAt: new Date().toISOString(),
      },
    ]);
    this.error.set(null);
  }

  protected removePreference(id: string): void {
    this.preferences.update((items) => items.filter((item) => item.id !== id));
  }

  protected setEnabled(id: string, enabled: boolean): void {
    this.updatePreference(id, (item) => ({ ...item, enabled }));
  }

  protected setChannel(id: string, channel: 'inApp' | 'email' | 'push', enabled: boolean): void {
    this.updatePreference(id, (item) => ({
      ...item,
      channels: { ...item.channels, [channel]: enabled },
    }));
  }

  protected setFrequency(id: string, frequency: string): void {
    this.updatePreference(id, (item) => ({
      ...item,
      frequency: frequency as NotificationFrequency,
    }));
  }

  protected savePreferences(): void {
    if (this.acting()) return;
    if (
      this.preferences().some(
        (item) =>
          item.enabled && !item.channels.inApp && !item.channels.email && !item.channels.push,
      )
    ) {
      this.error.set('Cada regla activa debe conservar al menos un canal.');
      return;
    }
    this.acting.set(true);
    this.error.set(null);
    this.api
      .replaceNotificationPreferences(
        this.preferences().map((item) => ({
          recipientUserId: item.recipient.id,
          eventType: item.eventType,
          enabled: item.enabled,
          inApp: item.channels.inApp,
          email: item.channels.email,
          push: item.channels.push,
          frequency: item.frequency,
        })),
      )
      .pipe(finalize(() => this.acting.set(false)))
      .subscribe({
        next: (data) => {
          this.preferences.set(data);
          this.notice.set('Reglas de notificación guardadas.');
        },
        error: (error: unknown) => this.error.set(this.message(error)),
      });
  }

  protected retryDeliveries(): void {
    if (this.acting()) return;
    this.acting.set(true);
    this.error.set(null);
    this.api
      .retryNotificationDeliveries()
      .pipe(finalize(() => this.acting.set(false)))
      .subscribe({
        next: (data) => {
          this.notice.set(`Reintentos: ${data.sent} enviados, ${data.failed} fallidos.`);
          this.loadManagement();
        },
        error: (error: unknown) => this.error.set(this.message(error)),
      });
  }

  private loadInbox(): void {
    const filters = this.filters.getRawValue();
    this.loading.set(true);
    this.error.set(null);
    this.api
      .notifications(
        filters.unreadOnly,
        (filters.type || undefined) as NotificationEventType | undefined,
      )
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (page) => {
          this.items.set(page.items);
          this.unread.set(page.unread);
          this.total.set(page.total);
        },
        error: (error: unknown) => this.error.set(this.message(error)),
      });
  }

  private loadManagement(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      settings: this.api.notificationPreferences(),
      deliveries: this.api.notificationDeliveries(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ settings, deliveries }) => {
          this.preferences.set(settings.preferences);
          this.recipients.set(settings.recipients);
          this.deliveries.set(deliveries);
          if (!this.newRecipientId()) {
            this.newRecipientId.set(settings.recipients[0]?.id ?? '');
          }
        },
        error: (error: unknown) => this.error.set(this.message(error)),
      });
  }

  private updatePreference(
    id: string,
    update: (item: NotificationPreference) => NotificationPreference,
  ): void {
    this.preferences.update((items) => items.map((item) => (item.id === id ? update(item) : item)));
  }

  private message(error: unknown): string {
    return error instanceof ApiError
      ? error.message
      : 'No fue posible actualizar las notificaciones.';
  }
}
