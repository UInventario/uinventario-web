export interface CompanyProfile {
  readonly legalName: string | null;
  readonly tradeName: string;
  readonly countryCode: string | null;
}

export interface CompanyOnboarding {
  readonly company: CompanyProfile;
  readonly progress: {
    readonly currentStep: 'COMPANY' | 'BRANCH' | 'COMPLETE';
    readonly completedSteps: readonly ('COMPANY' | 'BRANCH')[];
  };
}

export interface InitialLocation {
  readonly branch: { readonly id: string; readonly name: string; readonly timezone: string };
  readonly warehouse: { readonly id: string; readonly name: string };
  readonly location: { readonly id: string; readonly name: string; readonly code: string };
}

export interface InitialCashRegister {
  readonly cashRegister: { readonly id: string; readonly name: string; readonly code: string };
  readonly branch: { readonly id: string; readonly name: string };
}

export interface OrganizationLocation {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly active: boolean;
}

export interface OrganizationWarehouse {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
  readonly locations: readonly OrganizationLocation[];
}

export interface OrganizationCashRegister {
  readonly id: string;
  readonly name: string;
  readonly code: string;
}

export interface OrganizationBranch {
  readonly id: string;
  readonly name: string;
  readonly timezone: string;
  readonly active: boolean;
  readonly warehouses: readonly OrganizationWarehouse[];
  readonly cashRegisters: readonly OrganizationCashRegister[];
}

export interface CompanyInput {
  readonly legalName: string;
  readonly tradeName: string;
  readonly countryCode: string;
}

export interface InitialLocationInput {
  readonly branchName: string;
  readonly timezone: string;
  readonly warehouseName: string;
  readonly locationName: string;
}

export interface BranchInput {
  readonly name: string;
  readonly timezone: string;
  readonly warehouseName: string;
  readonly locationName: string;
  readonly locationCode: string;
}

export interface WarehouseInput {
  readonly name: string;
  readonly locationName: string;
  readonly locationCode: string;
}
