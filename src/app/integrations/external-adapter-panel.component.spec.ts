import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ExternalAdapterApiService } from './external-adapter-api.service';
import { ExternalAdapterPanelComponent } from './external-adapter-panel.component';

describe('ExternalAdapterPanelComponent', () => {
  let fixture: ComponentFixture<ExternalAdapterPanelComponent>;
  let api: {
    configurations: ReturnType<typeof vi.fn>;
    executions: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    diagnose: ReturnType<typeof vi.fn>;
  };
  const configuration = {
    id: 'config-1',
    capability: 'NOTIFICATION_EMAIL' as const,
    countryCode: 'MX',
    provider: 'SIMULATOR',
    adapterVersion: '1',
    enabled: true,
    timeoutMs: 1000,
    maxAttempts: 2,
    secretReference: null,
    updatedAt: '2026-08-29T12:00:00.000Z',
  };

  beforeEach(async () => {
    api = {
      configurations: vi
        .fn()
        .mockReturnValue(
          of({
            data: [configuration],
            meta: {
              apiVersion: '1',
              catalog: [],
              secrets: { storage: 'EXTERNAL_SECRET_MANAGER', valuesAcceptedByApi: false },
            },
          }),
        ),
      executions: vi
        .fn()
        .mockReturnValue(
          of({
            data: [
              {
                id: 'execution-1',
                capability: 'NOTIFICATION_EMAIL',
                provider: 'SIMULATOR',
                adapterVersion: '1',
                idempotencyKey: 'key',
                correlationId: 'request',
                status: 'TIMED_OUT',
                attemptCount: 2,
                errorCode: 'ADAPTER_TIMEOUT',
                providerReference: null,
                durationMs: 100,
                createdAt: '2026-08-29T12:00:00.000Z',
                updatedAt: '2026-08-29T12:00:00.000Z',
              },
            ],
            meta: { apiVersion: '1' },
          }),
        ),
      update: vi.fn().mockReturnValue(of({ data: configuration, meta: { apiVersion: '1' } })),
      diagnose: vi
        .fn()
        .mockReturnValue(
          of({ data: { status: 'SUCCEEDED', attemptCount: 2 }, meta: { apiVersion: '1' } }),
        ),
    };
    await TestBed.configureTestingModule({
      imports: [ExternalAdapterPanelComponent],
      providers: [{ provide: ExternalAdapterApiService, useValue: api }],
    }).compileComponents();
  });

  it('shows configuration and observable execution without secret values', async () => {
    fixture = TestBed.createComponent(ExternalAdapterPanelComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Email de notificaciones');
    expect(text).toContain('ADAPTER_TIMEOUT');
    expect(text).toContain('sólo acepta el nombre del secret');
  });

  it('saves and diagnoses the selected adapter', async () => {
    fixture = TestBed.createComponent(ExternalAdapterPanelComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const buttons = [...fixture.nativeElement.querySelectorAll('button')] as HTMLButtonElement[];
    buttons.find((button) => button.textContent?.includes('Guardar'))?.click();
    expect(api.update).toHaveBeenCalledWith(configuration);
    buttons.find((button) => button.textContent?.includes('Probar'))?.click();
    expect(api.diagnose).toHaveBeenCalledWith('NOTIFICATION_EMAIL', 'SUCCESS');
  });
});
