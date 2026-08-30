import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiClient } from '../../../core/api/api-client';
import { ApiEnvelope } from '../../../core/api/api-contracts';
import { OrganizationGateway } from '../domain/organization.gateway';
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
} from '../domain/organization.models';

type Response<T> = ApiEnvelope<T>;

@Injectable()
export class OrganizationApi extends OrganizationGateway {
  private readonly api = inject(ApiClient);

  override getCompany() {
    return this.data<CompanyOnboarding>(this.api.get('/onboarding/company'));
  }

  override configureCompany(input: CompanyInput) {
    return this.data<CompanyOnboarding>(this.api.put('/onboarding/company', input));
  }

  override getInitialLocation() {
    return this.data<InitialLocation | null>(this.api.get('/onboarding/initial-location'));
  }

  override configureInitialLocation(input: InitialLocationInput) {
    return this.data<InitialLocation>(this.api.put('/onboarding/initial-location', input));
  }

  override getInitialCashRegister() {
    return this.data<InitialCashRegister | null>(this.api.get('/onboarding/initial-cash-register'));
  }

  override configureInitialCashRegister(name: string) {
    return this.data<InitialCashRegister>(
      this.api.put('/onboarding/initial-cash-register', { name }),
    );
  }

  override listBranches() {
    return this.data<readonly OrganizationBranch[]>(this.api.get('/organization/branches'));
  }

  override createBranch(input: BranchInput) {
    return this.data<OrganizationBranch>(this.api.post('/organization/branches', input));
  }

  override updateBranch(id: string, input: Pick<BranchInput, 'name' | 'timezone'>) {
    return this.data<OrganizationBranch>(
      this.api.patch(`/organization/branches/${encodeURIComponent(id)}`, input),
    );
  }

  override retireBranch(id: string) {
    return this.api
      .delete<Response<unknown>>(`/organization/branches/${encodeURIComponent(id)}`)
      .pipe(map(() => undefined));
  }

  override createWarehouse(branchId: string, input: WarehouseInput) {
    return this.data<OrganizationWarehouse>(
      this.api.post(`/organization/branches/${encodeURIComponent(branchId)}/warehouses`, input),
    );
  }

  override updateWarehouse(id: string, name: string) {
    return this.data<OrganizationWarehouse>(
      this.api.patch(`/organization/warehouses/${encodeURIComponent(id)}`, { name }),
    );
  }

  override retireWarehouse(id: string) {
    return this.api
      .delete<Response<unknown>>(`/organization/warehouses/${encodeURIComponent(id)}`)
      .pipe(map(() => undefined));
  }

  override createCashRegister(
    branchId: string,
    input: { readonly name: string; readonly code: string },
  ) {
    return this.data<OrganizationCashRegister>(
      this.api.post(`/organization/branches/${encodeURIComponent(branchId)}/cash-registers`, input),
    );
  }

  private data<T>(request: Observable<unknown>) {
    return (request as Observable<Response<T>>).pipe(map(({ data }) => data));
  }
}
