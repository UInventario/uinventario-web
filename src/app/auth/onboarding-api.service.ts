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

interface CompanyOnboardingResponse {
  data: CompanyOnboardingData;
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
}
