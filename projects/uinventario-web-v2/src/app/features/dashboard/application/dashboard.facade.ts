import { Injectable, inject } from '@angular/core';
import { DashboardGateway } from '../domain/dashboard.gateway';
import {
  DashboardPeriod,
  NotificationEventType,
  NotificationPreferenceInput,
} from '../domain/dashboard.models';

@Injectable()
export class DashboardFacade {
  private readonly gateway = inject(DashboardGateway);

  sales(period: DashboardPeriod, branchId?: string) {
    return this.gateway.sales(period, branchId);
  }
  stockAlertTotal(status: 'LOW' | 'OUT_OF_STOCK') {
    return this.gateway.stockAlertTotal(status);
  }
  purchaseTotal() {
    return this.gateway.purchaseTotal();
  }
  latestForecast() {
    return this.gateway.latestForecast();
  }
  generateForecast(horizonDays: 7 | 14 | 30) {
    return this.gateway.generateForecast(horizonDays);
  }
  notifications(unreadOnly = false, eventType?: NotificationEventType, pageSize = 50) {
    return this.gateway.notifications(unreadOnly, eventType, pageSize);
  }
  refreshNotifications() {
    return this.gateway.refreshNotifications();
  }
  markNotificationRead(id: string) {
    return this.gateway.markNotificationRead(id);
  }
  markAllNotificationsRead() {
    return this.gateway.markAllNotificationsRead();
  }
  notificationPreferences() {
    return this.gateway.notificationPreferences();
  }
  replaceNotificationPreferences(preferences: readonly NotificationPreferenceInput[]) {
    return this.gateway.replaceNotificationPreferences(preferences);
  }
  notificationDeliveries() {
    return this.gateway.notificationDeliveries();
  }
  retryNotificationDeliveries() {
    return this.gateway.retryNotificationDeliveries();
  }
}
