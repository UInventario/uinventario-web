export type CommerceScope = 'CATALOG_READ' | 'STOCK_READ' | 'ORDERS_WRITE' | 'ORDERS_READ';
export type CommerceWebhookEvent =
  | 'ORDER_CONFIRMED'
  | 'ORDER_PREPARING'
  | 'ORDER_READY'
  | 'ORDER_DELIVERED'
  | 'ORDER_CANCELLED'
  | 'ORDER_FULFILLMENT_UPDATED';

export interface CommerceCredential {
  readonly id: string;
  readonly name: string;
  readonly keyPrefix: string;
  readonly scopes: readonly CommerceScope[];
  readonly context: {
    readonly branch: { readonly id: string; readonly name: string };
    readonly warehouse: { readonly id: string; readonly name: string };
    readonly cashRegister: { readonly id: string; readonly name: string; readonly code: string };
    readonly location: { readonly id: string; readonly name: string; readonly code: string };
    readonly customer: { readonly id: string; readonly name: string };
  };
  readonly active: boolean;
  readonly rateLimitPerMinute: number;
  readonly webhook: {
    readonly url: string | null;
    readonly events: readonly CommerceWebhookEvent[];
    readonly enabled: boolean;
    readonly mode: 'SIMULATOR' | 'LIVE';
  };
  readonly lastUsedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CommerceDelivery {
  readonly id: string;
  readonly eventId: string;
  readonly eventType: CommerceWebhookEvent;
  readonly targetUrl: string;
  readonly status: 'PENDING' | 'SUCCEEDED' | 'RETRYABLE_FAILURE' | 'FAILED';
  readonly attemptCount: number;
  readonly errorCode: string | null;
  readonly updatedAt: string;
  readonly deliveredAt: string | null;
}

export interface CommerceContract {
  readonly openapi: '3.1.0';
  readonly info: { readonly title: string; readonly version: string };
  readonly servers: readonly { readonly url: string }[];
  readonly paths: Readonly<
    Record<
      string,
      Readonly<
        Record<
          string,
          {
            readonly summary: string;
            readonly 'x-required-scope': CommerceScope;
            readonly responses: Readonly<Record<string, { readonly description: string }>>;
          }
        >
      >
    >
  >;
  readonly 'x-webhook-contract': {
    readonly version: '1';
    readonly signatureHeader: string;
    readonly signature: string;
    readonly attempts: { readonly automatic: number; readonly controlledMaximumTotal: number };
  };
}

export interface CommerceContextOption {
  readonly id: string;
  readonly label: string;
  readonly branchId: string;
  readonly warehouseId: string;
  readonly cashRegisterId: string;
  readonly locationId: string;
}

export interface CommerceCustomerOption {
  readonly id: string;
  readonly name: string;
}

export interface CommerceOptions {
  readonly contexts: readonly CommerceContextOption[];
  readonly customers: readonly CommerceCustomerOption[];
}

export interface CommerceCredentialInput {
  readonly name: string;
  readonly scopes: readonly CommerceScope[];
  readonly branchId: string;
  readonly warehouseId: string;
  readonly cashRegisterId: string;
  readonly locationId: string;
  readonly customerId: string;
  readonly rateLimitPerMinute: number;
  readonly webhookUrl?: string;
  readonly webhookEvents: readonly CommerceWebhookEvent[];
  readonly webhookEnabled: boolean;
}

export interface IssuedCommerceCredential {
  readonly credential: CommerceCredential;
  readonly oneTimeApiKey: string;
}

export interface CommerceLoadResult<T> {
  readonly data: T | null;
  readonly error: string | null;
}

export interface CommerceSnapshot {
  readonly credentials: CommerceLoadResult<readonly CommerceCredential[]>;
  readonly deliveries: CommerceLoadResult<readonly CommerceDelivery[]>;
  readonly contract: CommerceLoadResult<CommerceContract>;
  readonly options: CommerceLoadResult<CommerceOptions>;
}

export interface CommerceOperation {
  readonly method: string;
  readonly path: string;
  readonly summary: string;
  readonly scope: CommerceScope;
  readonly idempotent: boolean;
}
