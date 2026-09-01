import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { IntegrationFacade } from '../../application/integration.facade';
import { AdapterConfiguration } from '../../domain/integration.models';
import { IntegrationConsolePage } from './integration-console-page';

describe('IntegrationConsolePage', () => {
  const configuration: AdapterConfiguration = {
    id: 'adapter-1',
    capability: 'NOTIFICATION_EMAIL',
    countryCode: 'MX',
    provider: 'SIMULATOR',
    adapterVersion: '1',
    enabled: false,
    timeoutMs: 5000,
    maxAttempts: 3,
    secretReference: 'projects/dev/secrets/private-provider-key',
    updatedAt: '2026-08-30T10:00:00.000Z',
  };
  const facade = {
    load: vi.fn(),
    updateAdapter: vi.fn(),
    diagnose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    facade.load.mockReturnValue(
      of({
        adapters: {
          data: {
            configurations: [configuration],
            catalog: [
              {
                capability: 'NOTIFICATION_EMAIL',
                provider: 'SIMULATOR',
                version: '1',
                mode: 'SIMULATOR',
              },
            ],
          },
          error: null,
        },
        executions: { data: [], error: null },
        emailEvents: { data: [], error: null },
        providers: [],
      }),
    );
    facade.updateAdapter.mockReturnValue(of({ ...configuration, enabled: true }));
    TestBed.configureTestingModule({
      imports: [IntegrationConsolePage],
      providers: [{ provide: IntegrationFacade, useValue: facade }],
    });
  });

  it('never renders the existing secret reference', () => {
    const fixture = TestBed.createComponent(IntegrationConsolePage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    element.querySelectorAll<HTMLButtonElement>('.panel-tabs button')[1].click();
    fixture.detectChanges();

    expect(element.textContent).toContain('Referencia configurada');
    expect(element.textContent).not.toContain('private-provider-key');
    expect(element.querySelector<HTMLInputElement>('input[type="password"]')?.value).toBe('');
  });

  it('requires an explicit confirmation before activating an adapter', () => {
    const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const fixture = TestBed.createComponent(IntegrationConsolePage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    element.querySelectorAll<HTMLButtonElement>('.panel-tabs button')[1].click();
    fixture.detectChanges();
    const toggle = element.querySelector<HTMLInputElement>('.toggle input')!;
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change'));
    element.querySelector<HTMLButtonElement>('button.primary')!.click();

    expect(confirmation).toHaveBeenCalledOnce();
    expect(facade.updateAdapter).not.toHaveBeenCalled();

    confirmation.mockReturnValue(true);
    element.querySelector<HTMLButtonElement>('button.primary')!.click();
    expect(facade.updateAdapter).toHaveBeenCalledOnce();
  });
});
