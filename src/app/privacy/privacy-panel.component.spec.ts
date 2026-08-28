import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CustomerApiService, CustomerData } from '../customers/customer-api.service';
import { PrivacyApiService, PrivacyPolicyData, PrivacyReportData } from './privacy-api.service';
import { PrivacyPanelComponent } from './privacy-panel.component';

describe('PrivacyPanelComponent', () => {
  let fixture: ComponentFixture<PrivacyPanelComponent>;
  let privacy: {
    classification: ReturnType<typeof vi.fn>;
    policy: ReturnType<typeof vi.fn>;
    updatePolicy: ReturnType<typeof vi.fn>;
    report: ReturnType<typeof vi.fn>;
    export: ReturnType<typeof vi.fn>;
    createLegalHold: ReturnType<typeof vi.fn>;
    releaseLegalHold: ReturnType<typeof vi.fn>;
    anonymize: ReturnType<typeof vi.fn>;
  };
  let customers: { list: ReturnType<typeof vi.fn> };

  const customer: CustomerData = {
    id: 'customer-1',
    name: 'María Privada',
    identifier: 'PRIV-1',
    email: 'maria@example.com',
    phone: '+525512345678',
    dataProcessingConsent: true,
    privacyStatus: 'ACTIVE',
    anonymizedAt: null,
    privacyRetentionUntil: null,
    active: true,
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const policy: PrivacyPolicyData = {
    countryCode: 'MX',
    minimumTransactionRetentionDays: 1825,
    transactionRetentionDays: 1825,
    policyCode: 'MX_CFF_ARTICLE_30',
    version: 2,
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const report: PrivacyReportData = {
    subject: customer,
    transactions: {
      count: 1,
      firstAt: '2026-01-01T00:00:00.000Z',
      lastAt: '2026-01-01T00:00:00.000Z',
      retainedUntil: '2030-12-30T00:00:00.000Z',
      disposition: 'PRESERVED_WITHOUT_CASCADE_DELETE',
    },
    policy,
    activeLegalHold: null,
    recentDecisions: [],
    propagation: {
      primaryDatabase: 'IMMEDIATE',
      logs: 'NO_RAW_CUSTOMER_PII',
      backups: 'EXPIRES_WITH_BACKUP_LIFECYCLE_AND_REPLAY_REQUIRED',
      integrations: 'NO_CUSTOMER_PII_EXPORT_CONFIGURED',
    },
  };

  beforeEach(async () => {
    privacy = {
      classification: vi.fn().mockReturnValue(
        of({
          data: {
            version: 1,
            classes: [{ code: 'CUSTOMER_PII', fields: ['email'], controls: [] }],
            correctionEndpoint: 'PATCH /customers/:id',
            deletionMode: 'CONTROLLED_ANONYMIZATION',
          },
          meta: { apiVersion: '1' },
        }),
      ),
      policy: vi.fn().mockReturnValue(of({ data: policy, meta: { apiVersion: '1' } })),
      updatePolicy: vi.fn().mockReturnValue(of({ data: policy, meta: { apiVersion: '1' } })),
      report: vi.fn().mockReturnValue(of({ data: report, meta: { apiVersion: '1' } })),
      export: vi.fn().mockReturnValue(of(new Blob(['{}'], { type: 'application/json' }))),
      createLegalHold: vi.fn(),
      releaseLegalHold: vi.fn(),
      anonymize: vi.fn().mockReturnValue(
        of({
          data: { anonymized: true, privacyStatus: 'ANONYMIZED', retainedUntil: null },
          meta: { apiVersion: '1' },
        }),
      ),
    };
    customers = {
      list: vi.fn().mockReturnValue(
        of({
          data: [customer],
          meta: { apiVersion: '1', pagination: { total: 1, totalPages: 1 } },
        }),
      ),
    };
    await TestBed.configureTestingModule({
      imports: [PrivacyPanelComponent],
      providers: [
        { provide: PrivacyApiService, useValue: privacy },
        { provide: CustomerApiService, useValue: customers },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PrivacyPanelComponent);
    fixture.detectChanges();
  });

  it('loads policy, classification and customers together, then displays a tenant report', () => {
    expect(privacy.classification).toHaveBeenCalledOnce();
    expect(privacy.policy).toHaveBeenCalledOnce();
    expect(customers.list).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('MX_CFF_ARTICLE_30');

    const manage = fixture.nativeElement.querySelector(
      '.customer-list button',
    ) as HTMLButtonElement;
    manage.click();
    fixture.detectChanges();

    expect(privacy.report).toHaveBeenCalledWith(customer.id);
    expect(fixture.nativeElement.textContent).toContain('maria@example.com');
    expect(fixture.nativeElement.textContent).toContain('1 venta(s)');
  });

  it('requires confirmation and sends a reason before anonymizing PII', () => {
    const manage = fixture.nativeElement.querySelector(
      '.customer-list button',
    ) as HTMLButtonElement;
    manage.click();
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as {
      anonymizationForm: {
        setValue(value: { reason: string; requestReference: string }): void;
      };
      anonymize(): void;
    };
    component.anonymizationForm.setValue({
      reason: 'Solicitud ARCO verificada',
      requestReference: 'ARCO-1',
    });
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);

    component.anonymize();
    fixture.detectChanges();

    expect(privacy.anonymize).toHaveBeenCalledWith(
      customer.id,
      { reason: 'Solicitud ARCO verificada', requestReference: 'ARCO-1' },
      expect.stringMatching(/^web-privacy-anonymize-/),
    );
    expect(fixture.nativeElement.textContent).toContain('Identidad del cliente anonimizada');
  });

  it('shows the server legal-hold decision without losing the selected report', () => {
    const manage = fixture.nativeElement.querySelector(
      '.customer-list button',
    ) as HTMLButtonElement;
    manage.click();
    fixture.detectChanges();
    privacy.anonymize.mockReturnValue(
      throwError(() => ({
        error: { message: 'Existe un bloqueo legal activo para este cliente.' },
      })),
    );
    const component = fixture.componentInstance as unknown as {
      anonymizationForm: {
        setValue(value: { reason: string; requestReference: string }): void;
      };
      anonymize(): void;
    };
    component.anonymizationForm.setValue({
      reason: 'Solicitud ARCO verificada',
      requestReference: '',
    });
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);

    component.anonymize();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Existe un bloqueo legal activo para este cliente.',
    );
    expect(fixture.nativeElement.textContent).toContain('maria@example.com');
  });
});
