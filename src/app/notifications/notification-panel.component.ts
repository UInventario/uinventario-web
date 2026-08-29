import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { finalize, forkJoin } from 'rxjs';
import {
  NOTIFICATION_EVENT_TYPES,
  NotificationApiService,
  NotificationData,
  NotificationDeliveryData,
  NotificationEventType,
  NotificationFrequency,
  NotificationPreferenceData,
} from './notification-api.service';

@Component({
  selector: 'app-notification-panel',
  imports: [DatePipe],
  templateUrl: './notification-panel.component.html',
  styleUrl: './notification-panel.component.scss',
})
export class NotificationPanelComponent implements OnInit {
  private readonly api = inject(NotificationApiService);

  readonly canManage = input(false);
  protected readonly notifications = signal<NotificationData[]>([]);
  protected readonly preferences = signal<NotificationPreferenceData[]>([]);
  protected readonly recipients = signal<Array<{ id: string; email: string }>>([]);
  protected readonly deliveries = signal<NotificationDeliveryData[]>([]);
  protected readonly eventTypes = NOTIFICATION_EVENT_TYPES;
  protected readonly unread = signal(0);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly retrying = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly newRecipientId = signal('');
  protected readonly newEventType = signal<NotificationEventType>('STOCK_LOW');

  ngOnInit(): void {
    this.refresh();
  }

  protected refresh(): void {
    if (this.loading() && this.notifications().length > 0) return;
    this.loading.set(true);
    this.error.set(null);
    this.api
      .refresh()
      .pipe(finalize(() => this.loadData()))
      .subscribe({ error: (error: HttpErrorResponse) => this.error.set(this.message(error)) });
  }

  protected markRead(notification: NotificationData): void {
    if (notification.readAt) return;
    this.api.markRead(notification.id).subscribe({
      next: () => this.loadInbox(),
      error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
    });
  }

  protected markAllRead(): void {
    this.api.markAllRead().subscribe({
      next: ({ data }) => {
        this.success.set(`${data.changed} notificación(es) marcadas como leídas.`);
        this.loadInbox();
      },
      error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
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
    this.update(id, (item) => ({ ...item, enabled }));
  }

  protected setChannel(id: string, channel: 'inApp' | 'email' | 'push', enabled: boolean): void {
    this.update(id, (item) => ({
      ...item,
      channels: { ...item.channels, [channel]: enabled },
    }));
  }

  protected setFrequency(id: string, frequency: string): void {
    this.update(id, (item) => ({
      ...item,
      frequency: frequency as NotificationFrequency,
    }));
  }

  protected savePreferences(): void {
    if (this.saving()) return;
    const invalid = this.preferences().some(
      (item) => item.enabled && !item.channels.inApp && !item.channels.email && !item.channels.push,
    );
    if (invalid) {
      this.error.set('Cada regla habilitada debe tener al menos un canal.');
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.api
      .replacePreferences(
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
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.preferences.set(data);
          this.success.set('Preferencias de notificación guardadas.');
          this.refresh();
        },
        error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
      });
  }

  protected retryDeliveries(): void {
    if (this.retrying()) return;
    this.retrying.set(true);
    this.error.set(null);
    this.api
      .retryDeliveries()
      .pipe(finalize(() => this.retrying.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.success.set(
            `Reintentos procesados: ${data.sent} enviados, ${data.failed} fallidos.`,
          );
          this.loadManagement();
        },
        error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
      });
  }

  protected eventLabel(eventType: NotificationEventType): string {
    return {
      STOCK_LOW: 'Stock bajo o agotado',
      LOT_EXPIRING: 'Lotes por vencer',
      PURCHASE_PENDING: 'Compras pendientes',
      CASH_DIFFERENCE: 'Diferencias de caja',
      SYNC_FAILED: 'Fallos de sincronización',
      OPERATION_FAILED: 'Procesos con error',
    }[eventType];
  }

  protected deliveryLabel(status: NotificationDeliveryData['status']): string {
    return {
      PENDING: 'Pendiente',
      PROCESSING: 'Procesando',
      SENT: 'Enviada',
      FAILED: 'Fallida',
    }[status];
  }

  private loadData(): void {
    this.loading.set(true);
    if (this.canManage()) {
      forkJoin({
        inbox: this.api.list(),
        settings: this.api.preferences(),
        deliveries: this.api.deliveries(),
      })
        .pipe(finalize(() => this.loading.set(false)))
        .subscribe({
          next: ({ inbox, settings, deliveries }) => {
            this.notifications.set(inbox.data);
            this.unread.set(inbox.meta.unread);
            this.preferences.set(settings.data.preferences);
            this.recipients.set(settings.data.recipients);
            this.deliveries.set(deliveries.data);
            if (!this.newRecipientId())
              this.newRecipientId.set(settings.data.recipients[0]?.id ?? '');
          },
          error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
        });
      return;
    }
    this.api
      .list()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ data, meta }) => {
          this.notifications.set(data);
          this.unread.set(meta.unread);
        },
        error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
      });
  }

  private loadInbox(): void {
    this.api.list().subscribe({
      next: ({ data, meta }) => {
        this.notifications.set(data);
        this.unread.set(meta.unread);
      },
      error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
    });
  }

  private loadManagement(): void {
    if (!this.canManage()) return;
    forkJoin({ settings: this.api.preferences(), deliveries: this.api.deliveries() }).subscribe({
      next: ({ settings, deliveries }) => {
        this.preferences.set(settings.data.preferences);
        this.recipients.set(settings.data.recipients);
        this.deliveries.set(deliveries.data);
      },
      error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
    });
  }

  private update(
    id: string,
    change: (item: NotificationPreferenceData) => NotificationPreferenceData,
  ): void {
    this.preferences.update((items) => items.map((item) => (item.id === id ? change(item) : item)));
  }

  private message(error: HttpErrorResponse): string {
    if (error.status === 403) return 'No tienes permiso para esta operación de notificaciones.';
    if (error.status === 0) return 'No fue posible conectar con el servicio de notificaciones.';
    return 'No fue posible actualizar las notificaciones.';
  }
}
