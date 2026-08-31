import {
  OperationLineInput,
  Pagination,
  PaymentInput,
  PaymentMethod,
  SalesChannel,
} from './operations.models';

export type CustomerOrderPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type CustomerOrderStatus =
  'DRAFT' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';
export type FulfillmentStatus =
  | 'PENDING'
  | 'PREPARING'
  | 'READY'
  | 'RETRYABLE_FAILURE'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'CANCELLED';

export interface CustomerOrder {
  readonly id: string;
  readonly orderNumber: string;
  readonly channel: SalesChannel;
  readonly priority: CustomerOrderPriority;
  readonly status: CustomerOrderStatus;
  readonly version: number;
  readonly customer: {
    readonly id: string;
    readonly name: string;
    readonly identifier: string | null;
  };
  readonly context: {
    readonly branch: { readonly id: string; readonly name: string };
    readonly warehouse: { readonly id: string; readonly name: string };
    readonly cashRegister: { readonly id: string; readonly name: string; readonly code: string };
    readonly location: { readonly id: string; readonly name: string; readonly code: string };
  };
  readonly currency: string;
  readonly totals: { readonly subtotal: string; readonly tax: string; readonly total: string };
  readonly expiresInHours: number;
  readonly fulfillment: {
    readonly method: 'PICKUP' | 'DELIVERY';
    readonly status: FulfillmentStatus;
    readonly deliveryCost: string;
    readonly window: { readonly start: string; readonly end: string };
    readonly address: {
      readonly recipientNameMasked: string;
      readonly phoneMasked: string;
      readonly summary: string;
      readonly countryCode: string;
    } | null;
    readonly carrier: {
      readonly code: 'SIMULATED' | 'SIMULATED_RETRY';
      readonly name: string;
      readonly trackingReference: string | null;
      readonly trackingStatus:
        | 'LABEL_READY'
        | 'IN_TRANSIT'
        | 'OUT_FOR_DELIVERY'
        | 'DELIVERED'
        | 'EXCEPTION'
        | 'CANCELLED'
        | null;
      readonly manualActionRequired: boolean;
      readonly attempts: number;
      readonly lastErrorCode: string | null;
    } | null;
    readonly responsible: {
      readonly preparation: { readonly id: string; readonly email: string } | null;
      readonly delivery: { readonly id: string; readonly email: string } | null;
    };
  };
  readonly reservation: {
    readonly id: string;
    readonly reservationNumber: string;
    readonly status: string;
  } | null;
  readonly sale: { readonly id: string; readonly receiptNumber: string } | null;
  readonly lines: readonly {
    readonly id: string;
    readonly product: { readonly id: string; readonly name: string; readonly sku: string };
    readonly quantity: string;
    readonly serialNumbers: readonly string[];
    readonly total: string;
  }[];
  readonly payments: readonly {
    readonly id: string;
    readonly method: PaymentMethod;
    readonly amount: string;
    readonly amountReceived: string;
    readonly reference: string | null;
    readonly status: 'PLANNED' | 'COMPLETED' | 'CANCELLED';
  }[];
  readonly transitions: readonly {
    readonly id: string;
    readonly fromStatus: CustomerOrderStatus;
    readonly toStatus: CustomerOrderStatus;
    readonly reason: string | null;
    readonly actor: { readonly id: string; readonly email: string };
    readonly createdAt: string;
  }[];
  readonly cancellationReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CustomerOrderPage {
  readonly orders: readonly CustomerOrder[];
  readonly pagination: Pagination;
}

export interface CreateCustomerOrderInput {
  readonly channel: SalesChannel;
  readonly customerId: string;
  readonly locationId: string;
  readonly priority: CustomerOrderPriority;
  readonly expiresInHours: number;
  readonly fulfillment: {
    readonly method: 'PICKUP' | 'DELIVERY';
    readonly windowStart: string;
    readonly windowEnd: string;
    readonly deliveryCost: string;
    readonly recipientName?: string;
    readonly recipientPhone?: string;
    readonly addressLine1?: string;
    readonly addressLine2?: string;
    readonly city?: string;
    readonly region?: string;
    readonly postalCode?: string;
    readonly countryCode?: string;
    readonly carrierCode?: 'SIMULATED' | 'SIMULATED_RETRY';
  };
  readonly lines: readonly OperationLineInput[];
  readonly payments: readonly PaymentInput[];
}

export type OrderTransition = 'confirm' | 'prepare' | 'ready' | 'dispatch' | 'deliver' | 'cancel';

export interface ShippingContract {
  readonly provider: {
    readonly key: string;
    readonly version: string;
    readonly mode: string;
    readonly production: boolean;
  };
  readonly operations: readonly string[];
  readonly fallback: { readonly manualOperationAvailable: boolean };
}

export interface ShippingQuote {
  readonly quoteReference: string;
  readonly service: string;
  readonly amount: string;
  readonly currency: string;
  readonly estimatedDeliveryAt: string;
}
