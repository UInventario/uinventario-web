import { Observable } from 'rxjs';
import {
  BranchInput,
  CompanyInput,
  CompanyOnboarding,
  InitialCashRegister,
  InitialLocation,
  InitialLocationInput,
  OrganizationBranch,
  OrganizationCashRegister,
  OrganizationWarehouse,
  WarehouseInput,
} from './organization.models';

export abstract class OrganizationGateway {
  abstract getCompany(): Observable<CompanyOnboarding>;
  abstract configureCompany(input: CompanyInput): Observable<CompanyOnboarding>;
  abstract getInitialLocation(): Observable<InitialLocation | null>;
  abstract configureInitialLocation(input: InitialLocationInput): Observable<InitialLocation>;
  abstract getInitialCashRegister(): Observable<InitialCashRegister | null>;
  abstract configureInitialCashRegister(name: string): Observable<InitialCashRegister>;
  abstract listBranches(): Observable<readonly OrganizationBranch[]>;
  abstract createBranch(input: BranchInput): Observable<OrganizationBranch>;
  abstract updateBranch(
    id: string,
    input: Pick<BranchInput, 'name' | 'timezone'>,
  ): Observable<OrganizationBranch>;
  abstract retireBranch(id: string): Observable<void>;
  abstract createWarehouse(
    branchId: string,
    input: WarehouseInput,
  ): Observable<OrganizationWarehouse>;
  abstract updateWarehouse(id: string, name: string): Observable<OrganizationWarehouse>;
  abstract retireWarehouse(id: string): Observable<void>;
  abstract createCashRegister(
    branchId: string,
    input: { readonly name: string; readonly code: string },
  ): Observable<OrganizationCashRegister>;
}
