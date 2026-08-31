import {
  CartQuote,
  OperationLineInput,
  Pagination,
  PaymentInput,
  SalesChannel,
} from './operations.models';

export type QuotationStatus = 'ACTIVE' | 'EXPIRED' | 'CONVERTING' | 'CONVERTED';

export interface SalesQuotation {
  readonly id: string;
  readonly quotationNumber: string;
  readonly status: QuotationStatus;
  readonly version: number;
  readonly channel: SalesChannel;
  readonly customer: {
    readonly id: string;
    readonly name: string;
    readonly identifier: string | null;
  } | null;
  readonly reservation: {
    readonly id: string;
    readonly reservationNumber: string;
    readonly status: string;
  } | null;
  readonly sale: { readonly id: string; readonly receiptNumber: string } | null;
  readonly currency: string;
  readonly lines: CartQuote['lines'];
  readonly totals: CartQuote['totals'];
  readonly validUntil: string;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly convertedAt: string | null;
}

export interface QuotationPage {
  readonly quotations: readonly SalesQuotation[];
  readonly pagination: Pagination;
}

export interface QuotationInput {
  readonly customerId?: string;
  readonly reservationId?: string;
  readonly channel: SalesChannel;
  readonly validUntil: string;
  readonly notes?: string;
  readonly lines: readonly OperationLineInput[];
}

export interface QuotationDifference {
  readonly product: { readonly id: string; readonly name: string; readonly sku: string };
  readonly field: 'UNIT_PRICE' | 'AVAILABLE_STOCK' | 'TOTAL';
  readonly quoted: string;
  readonly current: string;
  readonly blocking: boolean;
}

export interface QuotationPreview {
  readonly quotation: SalesQuotation;
  readonly recalculated: CartQuote;
  readonly differences: readonly QuotationDifference[];
  readonly canConvert: boolean;
}

export interface ConvertQuotationInput {
  readonly version: number;
  readonly acceptDifferences: boolean;
  readonly payments: readonly PaymentInput[];
}

export interface QuotationConversion {
  readonly quotation: SalesQuotation;
  readonly sale: { readonly id: string; readonly receiptNumber: string };
  readonly differences: readonly QuotationDifference[];
}
