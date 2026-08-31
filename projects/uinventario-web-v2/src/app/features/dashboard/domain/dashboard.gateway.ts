import { Observable } from 'rxjs';
import {
  DashboardPeriod,
  DashboardSalesSummary,
  DemandForecast,
  NotificationDelivery,
  NotificationEventType,
  NotificationPage,
  NotificationPreference,
  NotificationPreferenceInput,
  NotificationSettings,
} from './dashboard.models';

export abstract class DashboardGateway {
  abstract sales(period: DashboardPeriod, branchId?: string): Observable<DashboardSalesSummary>;
  abstract stockAlertTotal(status: 'LOW' | 'OUT_OF_STOCK'): Observable<number>;
  abstract purchaseTotal(): Observable<number>;
  abstract latestForecast(): Observable<DemandForecast | null>;
  abstract generateForecast(horizonDays: 7 | 14 | 30): Observable<DemandForecast>;
  abstract notifications(
    unreadOnly?: boolean,
    eventType?: NotificationEventType,
    pageSize?: number,
  ): Observable<NotificationPage>;
  abstract refreshNotifications(): Observable<void>;
  abstract markNotificationRead(id: string): Observable<void>;
  abstract markAllNotificationsRead(): Observable<number>;
  abstract notificationPreferences(): Observable<NotificationSettings>;
  abstract replaceNotificationPreferences(
    preferences: readonly NotificationPreferenceInput[],
  ): Observable<readonly NotificationPreference[]>;
  abstract notificationDeliveries(): Observable<readonly NotificationDelivery[]>;
  abstract retryNotificationDeliveries(): Observable<{
    readonly sent: number;
    readonly failed: number;
  }>;
}
