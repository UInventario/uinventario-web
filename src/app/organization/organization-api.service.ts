import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';

export interface OrganizationLocationData {
  id: string;
  name: string;
  code: string;
  active: boolean;
}

export interface OrganizationWarehouseData {
  id: string;
  name: string;
  active: boolean;
  locations: OrganizationLocationData[];
}

export interface OrganizationBranchData {
  id: string;
  name: string;
  timezone: string;
  active: boolean;
  warehouses: OrganizationWarehouseData[];
  cashRegisters?: Array<{ id: string; name: string; code: string }>;
}

export interface BranchInput {
  name: string;
  timezone: string;
  warehouseName: string;
  locationName: string;
  locationCode: string;
}

export interface WarehouseInput {
  name: string;
  locationName: string;
  locationCode: string;
}

interface OrganizationListResponse {
  data: OrganizationBranchData[];
  meta: { apiVersion: '1' };
}

interface BranchResponse {
  data: OrganizationBranchData;
  meta: { apiVersion: '1' };
}

interface WarehouseResponse {
  data: OrganizationWarehouseData & { branchId: string };
  meta: { apiVersion: '1' };
}

interface CashRegisterResponse {
  data: { id: string; name: string; code: string; branchId: string };
  meta: { apiVersion: '1' };
}

interface RetirementResponse {
  data: { id: string; active: false };
  meta: { apiVersion: '1' };
}

@Injectable({ providedIn: 'root' })
export class OrganizationApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  list() {
    return this.http.get<OrganizationListResponse>(
      `${this.config.apiBaseUrl()}/organization/branches`,
      { withCredentials: true },
    );
  }

  createBranch(input: BranchInput) {
    return this.http.post<BranchResponse>(
      `${this.config.apiBaseUrl()}/organization/branches`,
      input,
      { withCredentials: true },
    );
  }

  updateBranch(id: string, input: Pick<BranchInput, 'name' | 'timezone'>) {
    return this.http.patch<BranchResponse>(
      `${this.config.apiBaseUrl()}/organization/branches/${id}`,
      input,
      { withCredentials: true },
    );
  }

  retireBranch(id: string) {
    return this.http.delete<RetirementResponse>(
      `${this.config.apiBaseUrl()}/organization/branches/${id}`,
      { withCredentials: true },
    );
  }

  createWarehouse(branchId: string, input: WarehouseInput) {
    return this.http.post<WarehouseResponse>(
      `${this.config.apiBaseUrl()}/organization/branches/${branchId}/warehouses`,
      input,
      { withCredentials: true },
    );
  }

  createCashRegister(branchId: string, input: { name: string; code: string }) {
    return this.http.post<CashRegisterResponse>(
      `${this.config.apiBaseUrl()}/organization/branches/${branchId}/cash-registers`,
      input,
      { withCredentials: true },
    );
  }

  updateWarehouse(id: string, input: Pick<WarehouseInput, 'name'>) {
    return this.http.patch<WarehouseResponse>(
      `${this.config.apiBaseUrl()}/organization/warehouses/${id}`,
      input,
      { withCredentials: true },
    );
  }

  retireWarehouse(id: string) {
    return this.http.delete<RetirementResponse>(
      `${this.config.apiBaseUrl()}/organization/warehouses/${id}`,
      { withCredentials: true },
    );
  }
}
