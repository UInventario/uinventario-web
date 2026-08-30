import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';

export const NOTIFICATION_EVENT_TYPES = [
  'STOCK_LOW',
  'LOT_EXPIRING',
  'PURCHASE_PENDING',
  'CASH_DIFFERENCE',
  'SYNC_FAILED',
  'OPERATION_FAILED',
] as const;

export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];
export type NotificationFrequency = 'IMMEDIATE' | 'DAILY_DIGEST';

export interface NotificationData {
  id: string;
  eventType: NotificationEventType;
  title: string;
  body: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  digestCount: number;
  sourceOccurredAt: string;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPreferenceData {
  id: string;
  recipient: { id: string; email: string };
  eventType: NotificationEventType;
  enabled: boolean;
  channels: { inApp: boolean; email: boolean; push: boolean };
  frequency: NotificationFrequency;
  updatedAt: string;
}

export interface NotificationPreferenceInput {
  recipientUserId: string;
  eventType: NotificationEventType;
  enabled: boolean;
  inApp: boolean;
  email: boolean;
  push: boolean;
  frequency: NotificationFrequency;
}

export interface NotificationDeliveryData {
  id: string;
  notificationId: string;
  recipient: { id: string; email: string };
  eventType: NotificationEventType;
  title: string;
  channel: 'EMAIL' | 'PUSH';
  adapter: string;
  status: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED';
  attemptCount: number;
  nextAttemptAt: string;
  errorCode: string | null;
  deliveredAt: string | null;
}

interface ApiResponse<T, TMeta = { apiVersion: '1' }> {
  data: T;
  meta: TMeta;
}

@Injectable({ providedIn: 'root' })
export class NotificationApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  refresh() {
    return this.http.post<
      ApiResponse<{
        reconciliation: { created: number; deduplicated: number };
        delivery: { sent: number; failed: number };
      }>
    >(`${this.config.apiBaseUrl()}/notifications/refresh`, {}, { withCredentials: true });
  }

  list(unreadOnly = false) {
    const params = new HttpParams().set('unreadOnly', String(unreadOnly)).set('pageSize', 50);
    return this.http.get<
      ApiResponse<
        NotificationData[],
        {
          apiVersion: '1';
          unread: number;
          pagination: { page: number; pageSize: number; total: number; totalPages: number };
        }
      >
    >(`${this.config.apiBaseUrl()}/notifications`, { withCredentials: true, params });
  }

  markRead(id: string) {
    return this.http.post<ApiResponse<{ id: string; read: true }>>(
      `${this.config.apiBaseUrl()}/notifications/${id}/read`,
      {},
      { withCredentials: true },
    );
  }

  markAllRead() {
    return this.http.post<ApiResponse<{ changed: number }>>(
      `${this.config.apiBaseUrl()}/notifications/read-all`,
      {},
      { withCredentials: true },
    );
  }

  preferences() {
    return this.http.get<
      ApiResponse<
        {
          preferences: NotificationPreferenceData[];
          recipients: Array<{ id: string; email: string }>;
        },
        { apiVersion: '1'; eventTypes: NotificationEventType[]; adapters: object }
      >
    >(`${this.config.apiBaseUrl()}/notifications/preferences`, { withCredentials: true });
  }

  replacePreferences(preferences: NotificationPreferenceInput[]) {
    return this.http.put<ApiResponse<NotificationPreferenceData[]>>(
      `${this.config.apiBaseUrl()}/notifications/preferences`,
      { preferences },
      { withCredentials: true },
    );
  }

  deliveries() {
    return this.http.get<ApiResponse<NotificationDeliveryData[]>>(
      `${this.config.apiBaseUrl()}/notifications/deliveries`,
      { withCredentials: true },
    );
  }

  retryDeliveries() {
    return this.http.post<ApiResponse<{ sent: number; failed: number }>>(
      `${this.config.apiBaseUrl()}/notifications/deliveries/retry`,
      {},
      { withCredentials: true },
    );
  }
}
