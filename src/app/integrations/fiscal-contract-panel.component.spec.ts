import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FiscalContractApiService } from './fiscal-contract-api.service';
import { FiscalContractPanelComponent } from './fiscal-contract-panel.component';

describe('FiscalContractPanelComponent', () => {
  let fixture: ComponentFixture<FiscalContractPanelComponent>;
  const response = {
    data: {
      countryCode: 'MX',
      configuration: {
        id: null,
        countryCode: 'MX',
        contractVersion: '1' as const,
        providerProfile: 'LIVE_GENERIC' as const,
        enabled: false,
        documentTypes: ['INVOICE' as const],
        taxCodes: ['VAT_16'],
        folioMode: 'PROVIDER' as const,
        taxIdentifier: null,
        certificateSecretReference: null,
        privateKeySecretReference: null,
        folioAuthorizationSecretReference: null,
        environment: 'TEST' as const,
        updatedAt: null,
      },
      contract: {
        countryCode: 'MX' as const,
        version: '1' as const,
        authority: 'SAT' as const,
        currency: 'MXN' as const,
        documentTypes: [
          { type: 'INVOICE' as const, countryCode: 'I', label: 'Comprobante de ingreso' },
        ],
        taxes: [{ code: 'VAT_16', label: 'IVA 16%', rate: 0.16 }],
        folioModes: ['PROVIDER' as const],
        capabilities: ['ISSUE' as const, 'QUERY' as const],
        providerProfiles: [
          {
            key: 'SIMULATOR' as const,
            mode: 'SIMULATOR' as const,
            runtimeAvailable: false as const,
            requirements: [],
          },
          {
            key: 'LIVE_GENERIC' as const,
            mode: 'LIVE' as const,
            runtimeAvailable: false as const,
            requirements: ['TAX_IDENTIFIER'],
          },
        ],
      },
      validation: {
        valid: false,
        readyForAdapter: false,
        missingRequirements: ['TAX_IDENTIFIER'],
        incompatibleSelections: [],
        runtime: 'NOT_IMPLEMENTED' as const,
      },
    },
    meta: { apiVersion: '1' as const, supportedCountries: ['MX', 'CL'] },
  };
  const api = {
    get: vi.fn().mockReturnValue(of(response)),
    update: vi.fn().mockReturnValue(
      of({
        data: { ...response.data, validation: { ...response.data.validation, valid: true } },
        meta: { apiVersion: '1' },
      }),
    ),
  };

  beforeEach(async () => {
    api.get.mockClear();
    api.update.mockClear();
    await TestBed.configureTestingModule({
      imports: [FiscalContractPanelComponent],
      providers: [{ provide: FiscalContractApiService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(FiscalContractPanelComponent);
    fixture.detectChanges();
  });

  it('shows the country contract, missing requirements and inactive runtime honestly', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('MX · SAT');
    expect(text).toContain('Comprobante de ingreso (I)');
    expect(text).toContain('IVA 16%');
    expect(text).toContain('Falta: Identificador fiscal');
    expect(text).toContain('no hay emisión activa');
  });

  it('saves a tenant-scoped draft without sending secret values', () => {
    const button = [...fixture.nativeElement.querySelectorAll('button')].find(
      (candidate: HTMLButtonElement) => candidate.textContent?.includes('Guardar contrato'),
    ) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    expect(api.update).toHaveBeenCalledWith(
      expect.objectContaining({
        countryCode: 'MX',
        contractVersion: '1',
        certificateSecretReference: null,
      }),
    );
    expect(fixture.nativeElement.textContent).toContain('Contrato fiscal guardado');
  });
});
