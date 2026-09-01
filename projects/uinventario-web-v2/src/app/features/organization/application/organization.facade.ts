import { Injectable, inject } from '@angular/core';
import { OperationalContextStore } from '../../../core/operational-context/operational-context.store';
import { OrganizationGateway } from '../domain/organization.gateway';
import {
  BranchInput,
  CompanyInput,
  InitialLocationInput,
  WarehouseInput,
} from '../domain/organization.models';

@Injectable()
export class OrganizationFacade {
  private readonly gateway = inject(OrganizationGateway);
  private readonly operationalContext = inject(OperationalContextStore);

  getCompany() {
    return this.gateway.getCompany();
  }

  configureCompany(input: CompanyInput) {
    return this.gateway.configureCompany({
      legalName: input.legalName.trim(),
      tradeName: input.tradeName.trim(),
      countryCode: input.countryCode.trim().toUpperCase(),
    });
  }

  getInitialLocation() {
    return this.gateway.getInitialLocation();
  }

  configureInitialLocation(input: InitialLocationInput) {
    return this.gateway.configureInitialLocation({
      branchName: input.branchName.trim(),
      timezone: input.timezone.trim(),
      warehouseName: input.warehouseName.trim(),
      locationName: input.locationName.trim(),
    });
  }

  getInitialCashRegister() {
    return this.gateway.getInitialCashRegister();
  }

  configureInitialCashRegister(name: string) {
    return this.gateway.configureInitialCashRegister(name.trim());
  }

  listBranches() {
    return this.gateway.listBranches();
  }

  createBranch(input: BranchInput) {
    return this.gateway.createBranch(this.normalizeBranch(input));
  }

  updateBranch(id: string, name: string, timezone: string) {
    return this.gateway.updateBranch(id, { name: name.trim(), timezone: timezone.trim() });
  }

  retireBranch(id: string) {
    return this.gateway.retireBranch(id);
  }

  createWarehouse(branchId: string, input: WarehouseInput) {
    return this.gateway.createWarehouse(branchId, {
      name: input.name.trim(),
      locationName: input.locationName.trim(),
      locationCode: input.locationCode.trim().toUpperCase(),
    });
  }

  updateWarehouse(id: string, name: string) {
    return this.gateway.updateWarehouse(id, name.trim());
  }

  retireWarehouse(id: string) {
    return this.gateway.retireWarehouse(id);
  }

  createCashRegister(branchId: string, name: string, code: string) {
    return this.gateway.createCashRegister(branchId, {
      name: name.trim(),
      code: code.trim().toUpperCase(),
    });
  }

  refreshOperationalContext() {
    return this.operationalContext.load(true);
  }

  private normalizeBranch(input: BranchInput): BranchInput {
    return {
      name: input.name.trim(),
      timezone: input.timezone.trim(),
      warehouseName: input.warehouseName.trim(),
      locationName: input.locationName.trim(),
      locationCode: input.locationCode.trim().toUpperCase(),
    };
  }
}
