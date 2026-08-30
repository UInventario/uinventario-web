import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';

export type FiscalDocumentType = 'INVOICE' | 'RECEIPT' | 'CREDIT_NOTE' | 'PAYMENT_RECEIPT';
export type FiscalProviderProfile = 'SIMULATOR' | 'LIVE_GENERIC';
export type FiscalFolioMode = 'PROVIDER' | 'LOCAL_AUTHORIZED';

export interface FiscalTenantConfiguration {
  id: string | null;
  countryCode: string;
  contractVersion: '1';
  providerProfile: FiscalProviderProfile;
  enabled: boolean;
  documentTypes: FiscalDocumentType[];
  taxCodes: string[];
  folioMode: FiscalFolioMode;
  taxIdentifier: string | null;
  certificateSecretReference: string | null;
  privateKeySecretReference: string | null;
  folioAuthorizationSecretReference: string | null;
  environment: 'TEST' | 'PRODUCTION' | null;
  updatedAt: string | null;
}

export interface FiscalCountryContract {
  countryCode: 'MX' | 'CL';
  version: '1';
  authority: 'SAT' | 'SII';
  currency: 'MXN' | 'CLP';
  documentTypes: Array<{ type: FiscalDocumentType; countryCode: string; label: string }>;
  taxes: Array<{ code: string; label: string; rate: number | null }>;
  folioModes: FiscalFolioMode[];
  capabilities: Array<
    'ISSUE' | 'QUERY' | 'CANCEL' | 'DOWNLOAD_PDF' | 'DOWNLOAD_XML' | 'ASYNC_CALLBACK'
  >;
  providerProfiles: Array<{
    key: FiscalProviderProfile;
    mode: 'SIMULATOR' | 'LIVE';
    runtimeAvailable: false;
    requirements: string[];
  }>;
}

export interface FiscalContractValidation {
  valid: boolean;
  readyForAdapter: boolean;
  missingRequirements: string[];
  incompatibleSelections: string[];
  runtime: 'NOT_IMPLEMENTED';
}

export interface FiscalContractData {
  countryCode: string;
  configuration: FiscalTenantConfiguration | null;
  contract: FiscalCountryContract | null;
  validation: FiscalContractValidation | null;
}

@Injectable({ providedIn: 'root' })
export class FiscalContractApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  get() {
    return this.http.get<{
      data: FiscalContractData;
      meta: { apiVersion: '1'; supportedCountries: string[] };
    }>(`${this.config.apiBaseUrl()}/integrations/fiscal/configuration`, {
      withCredentials: true,
    });
  }

  update(configuration: FiscalTenantConfiguration) {
    const body = {
      contractVersion: configuration.contractVersion,
      providerProfile: configuration.providerProfile,
      enabled: configuration.enabled,
      documentTypes: configuration.documentTypes,
      taxCodes: configuration.taxCodes,
      folioMode: configuration.folioMode,
      taxIdentifier: configuration.taxIdentifier,
      certificateSecretReference: configuration.certificateSecretReference,
      privateKeySecretReference: configuration.privateKeySecretReference,
      folioAuthorizationSecretReference: configuration.folioAuthorizationSecretReference,
      environment: configuration.environment,
    };
    return this.http.put<{
      data: FiscalContractData;
      meta: { apiVersion: '1' };
    }>(`${this.config.apiBaseUrl()}/integrations/fiscal/configuration`, body, {
      withCredentials: true,
    });
  }
}
