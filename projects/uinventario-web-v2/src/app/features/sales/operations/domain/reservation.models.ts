import { OperationLineInput } from './operations.models';

export type ReservationStatus = 'ACTIVE' | 'RELEASED' | 'EXPIRED' | 'CONSUMED';

export interface ProductReservation {
  readonly id: string;
  readonly reservationNumber: string;
  readonly status: ReservationStatus;
  readonly customer: {
    readonly id: string;
    readonly name: string;
    readonly identifier: string | null;
  };
  readonly context: {
    readonly branch: { readonly id: string; readonly name: string };
    readonly warehouse: { readonly id: string; readonly name: string };
    readonly location: { readonly id: string; readonly name: string; readonly code: string };
  };
  readonly responsible: { readonly id: string; readonly email: string };
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly closedAt: string | null;
  readonly closureReason: string | null;
  readonly sale: { readonly id: string; readonly receiptNumber: string } | null;
  readonly lines: readonly {
    readonly id: string;
    readonly product: { readonly id: string; readonly name: string; readonly sku: string };
    readonly quantity: string;
    readonly serialNumbers: readonly string[];
  }[];
}

export interface CreateReservationInput {
  readonly customerId: string;
  readonly locationId: string;
  readonly expiresInHours: number;
  readonly lines: readonly OperationLineInput[];
}
