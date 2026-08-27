import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';

export interface CompanyOnboardingData {
  company: {
    legalName: string | null;
    tradeName: string;
    countryCode: string | null;
  };
  progress: {
    currentStep: 'COMPANY' | 'BRANCH' | 'COMPLETE';
    completedSteps: Array<'COMPANY' | 'BRANCH'>;
  };
}

export interface InitialLocationData {
  branch: { id: string; name: string; timezone: string };
  warehouse: { id: string; name: string };
  location: { id: string; name: string; code: string };
  progress: { currentStep: 'REGISTER'; completedSteps: ['COMPANY', 'BRANCH'] };
}

export interface InitialCashRegisterData {
  cashRegister: { id: string; name: string; code: string };
  branch: { id: string; name: string };
  progress: {
    currentStep: 'COMPLETE';
    completedSteps: ['COMPANY', 'BRANCH', 'REGISTER'];
  };
}

interface CompanyOnboardingResponse {
  data: CompanyOnboardingData;
  meta: { apiVersion: '1' };
}

interface InitialLocationResponse {
  data: InitialLocationData | null;
  meta: { apiVersion: '1' };
}

interface InitialCashRegisterResponse {
  data: InitialCashRegisterData | null;
  meta: { apiVersion: '1' };
}

@Injectable({ providedIn: 'root' })
export class OnboardingApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  getCompany() {
    return this.http.get<CompanyOnboardingResponse>(
      `${this.config.apiBaseUrl()}/onboarding/company`,
      { withCredentials: true },
    );
  }

  configureCompany(input: { legalName: string; tradeName: string; countryCode: string }) {
    return this.http.put<CompanyOnboardingResponse>(
      `${this.config.apiBaseUrl()}/onboarding/company`,
      input,
      { withCredentials: true },
    );
  }

  getInitialLocation() {
    return this.http.get<InitialLocationResponse>(
      `${this.config.apiBaseUrl()}/onboarding/initial-location`,
      { withCredentials: true },
    );
  }

  configureInitialLocation(input: {
    branchName: string;
    timezone: string;
    warehouseName: string;
    locationName: string;
  }) {
    return this.http.put<InitialLocationResponse>(
      `${this.config.apiBaseUrl()}/onboarding/initial-location`,
      input,
      { withCredentials: true },
    );
  }

  getInitialCashRegister() {
    return this.http.get<InitialCashRegisterResponse>(
      `${this.config.apiBaseUrl()}/onboarding/initial-cash-register`,
      { withCredentials: true },
    );
  }

  configureInitialCashRegister(input: { name: string }) {
    return this.http.put<InitialCashRegisterResponse>(
      `${this.config.apiBaseUrl()}/onboarding/initial-cash-register`,
      input,
      { withCredentials: true },
    );
  }
}
