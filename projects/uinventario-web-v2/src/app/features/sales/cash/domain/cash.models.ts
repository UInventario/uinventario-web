export interface CashShift {
  readonly id: string;
  readonly status: 'OPEN';
  readonly branch: { readonly id: string; readonly name: string };
  readonly cashRegister: { readonly id: string; readonly name: string; readonly code: string };
  readonly openedBy: { readonly id: string; readonly email: string };
  readonly openingAmount: string;
  readonly currency: string;
  readonly openedAt: string;
}

export interface CashMovement {
  readonly id: string;
  readonly type: 'INCOME' | 'WITHDRAWAL' | 'REVERSAL';
  readonly amount: string;
  readonly reason: string;
  readonly responsible: { readonly id: string; readonly email: string };
  readonly reversalOf: {
    readonly id: string;
    readonly type: 'INCOME' | 'WITHDRAWAL';
    readonly reason: string;
  } | null;
  readonly reversed: boolean;
  readonly createdAt: string;
}

export interface CashMovementList {
  readonly movements: readonly CashMovement[];
  readonly shiftId: string;
  readonly currency: string;
  readonly expectedCash: string;
}

export interface CashClosure {
  readonly id: string;
  readonly status: 'CLOSED';
  readonly branch: { readonly id: string; readonly name: string };
  readonly cashRegister: { readonly id: string; readonly name: string; readonly code: string };
  readonly openedBy: { readonly id: string; readonly email: string };
  readonly closedBy: { readonly id: string; readonly email: string };
  readonly currency: string;
  readonly openingAmount: string;
  readonly salesCount: number;
  readonly cashSales: string;
  readonly movementsCount: number;
  readonly movementsNet: string;
  readonly expectedCash: string;
  readonly countedCash: string;
  readonly difference: string;
  readonly differenceReason: string | null;
  readonly denominations: readonly { readonly denomination: string; readonly quantity: number }[];
  readonly openedAt: string;
  readonly closedAt: string;
}

export interface CashMovementInput {
  readonly type: 'INCOME' | 'WITHDRAWAL';
  readonly amount: string;
  readonly reason: string;
}

export interface CashClosureInput {
  readonly countedAmount: string;
  readonly differenceReason?: string;
  readonly denominations?: readonly { readonly denomination: string; readonly quantity: number }[];
}
