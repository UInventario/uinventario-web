import { FormGroup } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CommerceFacade } from '../../application/commerce.facade';
import { CommerceConsolePage } from './commerce-console-page';

describe('CommerceConsolePage', () => {
  const facade = {
    load: vi.fn(),
    operations: vi.fn().mockReturnValue([]),
    create: vi.fn(),
    rotate: vi.fn(),
    revoke: vi.fn(),
    replay: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    facade.operations.mockReturnValue([]);
    facade.load.mockReturnValue(
      of({
        credentials: { data: [], error: null },
        deliveries: { data: [], error: null },
        contract: { data: null, error: null },
        options: {
          data: {
            contexts: [
              {
                id: 'context-1',
                label: 'Centro · Principal · Piso · Caja 1',
                branchId: 'branch-1',
                warehouseId: 'warehouse-1',
                locationId: 'location-1',
                cashRegisterId: 'register-1',
              },
            ],
            customers: [{ id: 'customer-1', name: 'Marketplace' }],
          },
          error: null,
        },
      }),
    );
    facade.create.mockReturnValue(
      of({
        credential: {
          id: 'credential-1',
          name: 'Marketplace',
          keyPrefix: 'uic_abcd1234',
          scopes: ['CATALOG_READ'],
          context: {
            branch: { id: 'branch-1', name: 'Centro' },
            warehouse: { id: 'warehouse-1', name: 'Principal' },
            location: { id: 'location-1', name: 'Piso', code: 'PISO' },
            cashRegister: { id: 'register-1', name: 'Caja 1', code: 'C1' },
            customer: { id: 'customer-1', name: 'Marketplace' },
          },
          active: true,
          rateLimitPerMinute: 60,
          webhook: { url: null, events: [], enabled: false, mode: 'SIMULATOR' },
          lastUsedAt: null,
          createdAt: '2026-08-31T10:00:00.000Z',
          updatedAt: '2026-08-31T10:00:00.000Z',
        },
        oneTimeApiKey: 'fixture-one-time-key',
      }),
    );
    TestBed.configureTestingModule({
      imports: [CommerceConsolePage],
      providers: [{ provide: CommerceFacade, useValue: facade }],
    });
  });

  it('keeps a newly issued key outside the DOM until explicit reveal', () => {
    const fixture = TestBed.createComponent(CommerceConsolePage);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as {
      form: FormGroup;
      create(): void;
    };
    component.form.patchValue({
      name: 'Marketplace',
      contextId: 'context-1',
      customerId: 'customer-1',
    });
    component.create();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).not.toContain('fixture-one-time-key');
    element.querySelector<HTMLButtonElement>('.secret-actions .secondary')!.click();
    fixture.detectChanges();
    expect(element.textContent).toContain('fixture-one-time-key');
  });
});
