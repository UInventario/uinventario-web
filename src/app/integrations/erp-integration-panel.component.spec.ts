import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ErpIntegrationApiService } from './erp-integration-api.service';
import { ErpIntegrationPanelComponent } from './erp-integration-panel.component';

describe('ErpIntegrationPanelComponent', () => {
  let fixture: ComponentFixture<ErpIntegrationPanelComponent>;
  const resources = [
    'PRODUCT',
    'SUPPLIER',
    'CUSTOMER',
    'PURCHASE_ORDER',
    'PURCHASE_RECEIPT',
    'SALE',
  ] as const;
  const api = {
    contract: vi.fn().mockReturnValue(
      of({
        data: {
          name: 'UINVENTARIO_ERP_EXCHANGE' as const,
          version: '1' as const,
          mode: 'SIMULATOR' as const,
          production: false as const,
          resources: resources.map((resource) => ({
            resource,
            directions: ['EXPORT_INCREMENTAL' as const, 'IMPORT_IDENTITY_MAPPING' as const],
          })),
          guarantees: { tenantScoped: true, idempotentImports: true },
        },
        meta: { apiVersion: '1' as const },
      }),
    ),
    mappings: vi.fn().mockReturnValue(of({ data: [], meta: {} })),
    runs: vi.fn().mockReturnValue(of({ data: [], meta: {} })),
    export: vi.fn().mockReturnValue(
      of({
        data: [
          {
            resource: 'PRODUCT' as const,
            internalId: '00000000-0000-0000-0000-000000000001',
            externalId: null,
            payload: { sku: 'SKU-1' },
            changedAt: '2026-08-29T12:00:00.000Z',
          },
        ],
        meta: { nextCursor: 'next', hasMore: true },
      }),
    ),
    importMappings: vi.fn().mockReturnValue(
      of({
        data: {
          status: 'COMPLETED',
          summary: { total: 2, linked: 1, failed: 1 },
          results: [
            {
              index: 0,
              resource: 'PRODUCT',
              externalId: 'ERP-1',
              internalId: '00000000-0000-0000-0000-000000000001',
              status: 'LINKED',
              replay: false,
              errorCode: null,
            },
            {
              index: 1,
              resource: 'CUSTOMER',
              externalId: 'ERP-2',
              internalId: '00000000-0000-0000-0000-000000000002',
              status: 'ERROR',
              replay: false,
              errorCode: 'INTERNAL_RECORD_NOT_FOUND',
            },
          ],
        },
        meta: {},
      }),
    ),
  };

  beforeEach(async () => {
    Object.values(api).forEach((mock) => mock.mockClear());
    await TestBed.configureTestingModule({
      imports: [ErpIntegrationPanelComponent],
      providers: [{ provide: ErpIntegrationApiService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(ErpIntegrationPanelComponent);
    fixture.detectChanges();
  });

  it('shows the six resources and exports an incremental page', () => {
    const text = fixture.nativeElement.textContent as string;
    resources.forEach((resource) => expect(text).toContain(resource));

    const exportButton = [...fixture.nativeElement.querySelectorAll('button')].find(
      (candidate: HTMLButtonElement) => candidate.textContent?.includes('Exportar primera página'),
    ) as HTMLButtonElement;
    exportButton.click();
    fixture.detectChanges();

    expect(api.export).toHaveBeenCalledWith('SIMULATOR', 'PRODUCT', undefined);
    expect(fixture.nativeElement.textContent).toContain('SKU-1');
    expect(fixture.nativeElement.textContent).toContain('Continuar cursor');
  });

  it('keeps partial import results in request order', () => {
    const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = [
      'PRODUCT,ERP-1,00000000-0000-0000-0000-000000000001',
      'CUSTOMER,ERP-2,00000000-0000-0000-0000-000000000002',
    ].join('\n');
    textarea.dispatchEvent(new Event('input'));
    const importButton = [...fixture.nativeElement.querySelectorAll('button')].find(
      (candidate: HTMLButtonElement) => candidate.textContent?.includes('Procesar lote'),
    ) as HTMLButtonElement;
    importButton.click();
    fixture.detectChanges();

    expect(api.importMappings).toHaveBeenCalledWith('SIMULATOR', [
      {
        resource: 'PRODUCT',
        externalId: 'ERP-1',
        internalId: '00000000-0000-0000-0000-000000000001',
      },
      {
        resource: 'CUSTOMER',
        externalId: 'ERP-2',
        internalId: '00000000-0000-0000-0000-000000000002',
      },
    ]);
    const text = fixture.nativeElement.textContent as string;
    expect(text.indexOf('#1 · PRODUCT · LINKED')).toBeLessThan(
      text.indexOf('#2 · CUSTOMER · ERROR'),
    );
    expect(text).toContain('INTERNAL_RECORD_NOT_FOUND');
  });
});
