import { ApiEnvelope } from '../api/api-contracts';

export interface OperationalLocation {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly active: boolean;
}

export interface OperationalWarehouse {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
  readonly locations: readonly OperationalLocation[];
}

export interface OperationalCashRegister {
  readonly id: string;
  readonly name: string;
  readonly code: string;
}

export interface OperationalBranch {
  readonly id: string;
  readonly name: string;
  readonly timezone: string;
  readonly active: boolean;
  readonly warehouses: readonly OperationalWarehouse[];
  readonly cashRegisters: readonly OperationalCashRegister[];
}

export interface OperationalContextSelection {
  readonly branchId: string;
  readonly warehouseId: string;
  readonly cashRegisterId?: string;
}

export type OperationalBranchesResponse = ApiEnvelope<readonly OperationalBranch[]>;
