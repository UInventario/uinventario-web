import { HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, of, throwError } from 'rxjs';
import { ApiClient } from '../../../core/api/api-client';
import { ApiEnvelope } from '../../../core/api/api-contracts';
import { ApiError } from '../../../core/api/api-error';
import { DashboardGateway } from '../domain/dashboard.gateway';
import {
  DashboardPeriod,
  DashboardSalesSummary,
  DemandForecast,
  NotificationDelivery,
  NotificationEventType,
  NotificationItem,
  NotificationPage,
  NotificationPreference,
  NotificationPreferenceInput,
} from '../domain/dashboard.models';

interface PaginationMeta {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

@Injectable()
export class DashboardApi extends DashboardGateway {
  private readonly api = inject(ApiClient);

  override sales(period: DashboardPeriod, branchId?: string) {
    return this.api
      .get<
        ApiEnvelope<{
          readonly summary: {
            readonly sales: { readonly completed: number; readonly net: string };
            readonly reconciliation: { readonly matches: boolean };
          };
        }>
      >('/pos/reports/sales-cash', {
        params: {
          ...period,
          ...(branchId ? { branchId } : {}),
          status: 'ALL',
          page: 1,
          pageSize: 1,
        },
      })
      .pipe(
        map(
          ({ data }) =>
            ({
              net: data.summary.sales.net,
              completed: data.summary.sales.completed,
              paymentsMatch: data.summary.reconciliation.matches,
            }) satisfies DashboardSalesSummary,
        ),
      );
  }

  override stockAlertTotal(status: 'LOW' | 'OUT_OF_STOCK') {
    return this.api
      .get<ApiEnvelope<readonly unknown[], { readonly pagination: PaginationMeta }>>(
        '/inventory/stock-alerts',
        { params: { status, page: 1, pageSize: 1 } },
      )
      .pipe(map(({ meta }) => meta.pagination.total));
  }

  override purchaseTotal() {
    return this.api
      .get<ApiEnvelope<readonly unknown[], { readonly pagination: PaginationMeta }>>(
        '/purchase-orders',
        { params: { page: 1, pageSize: 1 } },
      )
      .pipe(map(({ meta }) => meta.pagination.total));
  }

  override latestForecast() {
    return this.api.get<ApiEnvelope<DemandForecast>>('/forecasting/demand/latest').pipe(
      map(({ data }) => data),
      catchError((error: unknown) =>
        error instanceof ApiError && error.status === 404 ? of(null) : throwError(() => error),
      ),
    );
  }

  override generateForecast(horizonDays: 7 | 14 | 30) {
    return this.api
      .post<ApiEnvelope<DemandForecast>, { readonly horizonDays: number }>(
        '/forecasting/demand/runs',
        { horizonDays },
        { headers: new HttpHeaders({ 'Idempotency-Key': `web-forecast-${crypto.randomUUID()}` }) },
      )
      .pipe(map(({ data }) => data));
  }

  override notifications(unreadOnly = false, eventType?: NotificationEventType, pageSize = 50) {
    return this.api
      .get<
        ApiEnvelope<
          readonly NotificationItem[],
          { readonly unread: number; readonly pagination: PaginationMeta }
        >
      >('/notifications', {
        params: {
          unreadOnly,
          ...(eventType ? { eventType } : {}),
          page: 1,
          pageSize,
        },
      })
      .pipe(
        map(
          ({ data, meta }) =>
            ({
              items: data,
              unread: meta.unread,
              total: meta.pagination.total,
            }) satisfies NotificationPage,
        ),
      );
  }

  override refreshNotifications() {
    return this.api
      .post<ApiEnvelope<unknown>, object>('/notifications/refresh', {})
      .pipe(map(() => undefined));
  }

  override markNotificationRead(id: string) {
    return this.api
      .post<ApiEnvelope<{ readonly id: string; readonly read: true }>, object>(
        `/notifications/${encodeURIComponent(id)}/read`,
        {},
      )
      .pipe(map(() => undefined));
  }

  override markAllNotificationsRead() {
    return this.api
      .post<ApiEnvelope<{ readonly changed: number }>, object>('/notifications/read-all', {})
      .pipe(map(({ data }) => data.changed));
  }

  override notificationPreferences() {
    return this.api
      .get<
        ApiEnvelope<{
          readonly preferences: readonly NotificationPreference[];
          readonly recipients: readonly { readonly id: string; readonly email: string }[];
        }>
      >('/notifications/preferences')
      .pipe(map(({ data }) => data));
  }

  override replaceNotificationPreferences(preferences: readonly NotificationPreferenceInput[]) {
    return this.api
      .put<
        ApiEnvelope<readonly NotificationPreference[]>,
        { readonly preferences: readonly NotificationPreferenceInput[] }
      >('/notifications/preferences', { preferences })
      .pipe(map(({ data }) => data));
  }

  override notificationDeliveries() {
    return this.api
      .get<ApiEnvelope<readonly NotificationDelivery[]>>('/notifications/deliveries')
      .pipe(map(({ data }) => data));
  }

  override retryNotificationDeliveries() {
    return this.api
      .post<ApiEnvelope<{ readonly sent: number; readonly failed: number }>, object>(
        '/notifications/deliveries/retry',
        {},
      )
      .pipe(map(({ data }) => data));
  }
}
