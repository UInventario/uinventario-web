export const DASHBOARD_WIDGETS = [
  'sales',
  'stock',
  'purchases',
  'forecast',
  'notifications',
] as const;

export type DashboardWidget = (typeof DASHBOARD_WIDGETS)[number];

export interface DashboardPeriod {
  readonly dateFrom: string;
  readonly dateTo: string;
}

export interface DashboardQuery extends DashboardPeriod {
  readonly widgets: readonly DashboardWidget[];
}

export interface DashboardSalesSummary {
  readonly net: string;
  readonly completed: number;
  readonly paymentsMatch: boolean;
}

export interface DemandForecast {
  readonly id: string;
  readonly branch: { readonly id: string; readonly name: string; readonly timezone: string };
  readonly status: 'READY' | 'INSUFFICIENT';
  readonly asOfDate: string;
  readonly horizonDays: number;
  readonly model: 'WEEKDAY_BASELINE_V1';
  readonly assumptions: readonly string[];
  readonly generatedAt: string;
  readonly items: readonly DemandForecastItem[];
  readonly summary: {
    readonly sufficient: number;
    readonly insufficient: number;
    readonly driftWarnings: number;
  };
}

export interface DemandForecastItem {
  readonly product: { readonly id: string; readonly name: string; readonly sku: string };
  readonly status: 'SUFFICIENT' | 'INSUFFICIENT';
  readonly quality: {
    readonly coverageDays: number;
    readonly daysWithDemand: number;
    readonly totalDemand: number;
    readonly minimum: {
      readonly coverageDays: number;
      readonly daysWithDemand: number;
      readonly totalDemand: number;
    };
    readonly backtest: { readonly samples: number; readonly meanAbsoluteError: number | null };
    readonly drift: {
      readonly ratio: number | null;
      readonly status: 'STABLE' | 'WARNING' | 'UNKNOWN';
    };
  };
  readonly forecast: {
    readonly horizonDays: number;
    readonly expectedDemand: number;
    readonly interval: {
      readonly confidence: 'APPROXIMATE_80';
      readonly lower: number;
      readonly upper: number;
    };
    readonly availableQuantity: number;
    readonly suggestedReorderQuantity: number;
  } | null;
}

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

export interface NotificationItem {
  readonly id: string;
  readonly eventType: NotificationEventType;
  readonly title: string;
  readonly body: string;
  readonly severity: 'INFO' | 'WARNING' | 'CRITICAL';
  readonly digestCount: number;
  readonly sourceOccurredAt: string;
  readonly readAt: string | null;
  readonly createdAt: string;
}

export interface NotificationPreference {
  readonly id: string;
  readonly recipient: { readonly id: string; readonly email: string };
  readonly eventType: NotificationEventType;
  readonly enabled: boolean;
  readonly channels: { readonly inApp: boolean; readonly email: boolean; readonly push: boolean };
  readonly frequency: NotificationFrequency;
  readonly updatedAt: string;
}

export interface NotificationPreferenceInput {
  readonly recipientUserId: string;
  readonly eventType: NotificationEventType;
  readonly enabled: boolean;
  readonly inApp: boolean;
  readonly email: boolean;
  readonly push: boolean;
  readonly frequency: NotificationFrequency;
}

export interface NotificationSettings {
  readonly preferences: readonly NotificationPreference[];
  readonly recipients: readonly { readonly id: string; readonly email: string }[];
}

export interface NotificationDelivery {
  readonly id: string;
  readonly notificationId: string;
  readonly recipient: { readonly id: string; readonly email: string };
  readonly eventType: NotificationEventType;
  readonly title: string;
  readonly channel: 'EMAIL' | 'PUSH';
  readonly adapter: string;
  readonly status: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED';
  readonly attemptCount: number;
  readonly nextAttemptAt: string;
  readonly errorCode: string | null;
  readonly deliveredAt: string | null;
}

export interface NotificationPage {
  readonly items: readonly NotificationItem[];
  readonly unread: number;
  readonly total: number;
}
