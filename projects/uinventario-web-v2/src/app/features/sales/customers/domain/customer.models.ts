export type CustomerStatus = 'ACTIVE' | 'INACTIVE' | 'ALL';

export interface CustomerCredit {
  readonly enabled: boolean;
  readonly limit: string;
  readonly currency: string;
  readonly termDays: number;
  readonly maxInstallments: number;
  readonly balance: string;
  readonly available: string;
  readonly overdueAmount: string;
  readonly status: 'DISABLED' | 'AVAILABLE' | 'LIMIT_REACHED' | 'OVERDUE';
}

export interface Customer {
  readonly id: string;
  readonly name: string;
  readonly identifier: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly dataProcessingConsent: boolean;
  readonly privacyStatus: 'ACTIVE' | 'ANONYMIZED';
  readonly anonymizedAt: string | null;
  readonly privacyRetentionUntil: string | null;
  readonly active: boolean;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly credit: CustomerCredit | null;
}

export interface CustomerInput {
  readonly name: string;
  readonly identifier?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly dataProcessingConsent: boolean;
  readonly active?: boolean;
}

export interface CustomerQuery {
  readonly q?: string;
  readonly status: CustomerStatus;
  readonly page: number;
  readonly pageSize: number;
}

export interface CustomerPage {
  readonly customers: readonly Customer[];
  readonly pagination: Pagination;
}

export interface Pagination {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface CustomerHistory {
  readonly customer: Customer;
  readonly credit: CustomerCreditStatement | null;
  readonly summary: {
    readonly currency: string | null;
    readonly salesCount: number;
    readonly completedCount: number;
    readonly voidedCount: number;
    readonly completedAmount: string;
    readonly voidedAmount: string;
  };
  readonly items: readonly CustomerHistoryItem[];
}

export interface CustomerHistoryItem {
  readonly id: string;
  readonly receiptNumber: string;
  readonly status: 'COMPLETED' | 'VOIDED';
  readonly currency: string;
  readonly total: string;
  readonly createdAt: string;
  readonly cashRegister: { readonly id: string; readonly name: string; readonly code: string };
  readonly responsible: { readonly id: string; readonly email: string };
  readonly payments: readonly {
    readonly method: string;
    readonly status: string;
    readonly amountApplied: string;
  }[];
  readonly reversal: { readonly reason: string; readonly voidedAt: string } | null;
}

export interface CustomerCreditStatement {
  readonly currency: string;
  readonly balance: string;
  readonly overdueAmount: string;
  readonly status: CustomerCredit['status'];
  readonly accounts: readonly {
    readonly id: string;
    readonly sale: { readonly id: string; readonly receiptNumber: string };
    readonly originalAmount: string;
    readonly balance: string;
    readonly dueDate: string;
    readonly status: string;
  }[];
  readonly payments: readonly CustomerCreditPayment[];
}

export type CustomerCreditPaymentMethod = 'CASH' | 'CARD' | 'TRANSFER';

export interface CustomerCreditPayment {
  readonly id: string;
  readonly receiptNumber: string;
  readonly currency: string;
  readonly amount: string;
  readonly method: CustomerCreditPaymentMethod;
  readonly status: 'COMPLETED' | 'REVERSED';
  readonly reference: string | null;
  readonly responsible: { readonly id: string; readonly email: string };
  readonly reversal: {
    readonly reason: string;
    readonly reversedAt: string;
  } | null;
  readonly createdAt: string;
}

export interface CustomerCreditPaymentInput {
  readonly amount: string;
  readonly method: CustomerCreditPaymentMethod;
  readonly reference?: string;
}

export interface CustomerCreditPaymentResult {
  readonly payment: CustomerCreditPayment;
  readonly credit: CustomerCreditStatement;
}

export interface CustomerHistoryPage {
  readonly history: CustomerHistory;
  readonly pagination: Pagination;
}

export interface CreditInput {
  readonly enabled: boolean;
  readonly creditLimit: string;
  readonly currency: string;
  readonly termDays: number;
  readonly maxInstallments: number;
  readonly version: number;
}

export interface PrivacyPolicy {
  readonly countryCode: string;
  readonly minimumTransactionRetentionDays: number;
  readonly transactionRetentionDays: number;
  readonly policyCode: string;
  readonly version: number;
  readonly updatedAt: string;
}

export interface PrivacyLegalHold {
  readonly id: string;
  readonly active: boolean;
  readonly reason: string;
  readonly expiresAt: string | null;
  readonly createdAt: string;
}

export interface PrivacyDecision {
  readonly id: string;
  readonly type: string;
  readonly status: 'COMPLETED' | 'BLOCKED';
  readonly decisionCode: string;
  readonly requestReference: string | null;
  readonly createdAt: string;
}

export interface CustomerPrivacyReport {
  readonly subject: Customer;
  readonly transactions: {
    readonly count: number;
    readonly firstAt: string | null;
    readonly lastAt: string | null;
    readonly retainedUntil: string | null;
    readonly disposition: string;
  };
  readonly policy: PrivacyPolicy;
  readonly activeLegalHold: PrivacyLegalHold | null;
  readonly recentDecisions: readonly PrivacyDecision[];
  readonly propagation: Readonly<Record<string, string>>;
}

export interface PrivacyActionInput {
  readonly reason: string;
  readonly requestReference?: string;
}

export interface LegalHoldInput extends PrivacyActionInput {
  readonly expiresAt?: string;
}

export interface PrivacyPolicyInput extends PrivacyActionInput {
  readonly transactionRetentionDays: number;
  readonly expectedVersion: number;
}
