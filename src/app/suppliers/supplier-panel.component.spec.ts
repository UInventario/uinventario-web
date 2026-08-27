import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { SupplierApiService, SupplierData } from './supplier-api.service';
import { SupplierPanelComponent } from './supplier-panel.component';

describe('SupplierPanelComponent', () => {
  let fixture: ComponentFixture<SupplierPanelComponent>;
  let api: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    deactivate: ReturnType<typeof vi.fn>;
  };

  const supplier: SupplierData = {
    id: 'supplier',
    legalName: 'Café Mayorista, S.A. de C.V.',
    tradeName: 'Café Mayorista',
    countryCode: 'MX',
    identifierType: 'RFC',
    taxIdentifier: 'ABC010203AB1',
    active: true,
    version: 1,
    contacts: [
      {
        id: 'contact',
        name: 'Ana Compras',
        email: 'ana@proveedor.example',
        phone: null,
        role: 'Ventas',
        primary: true,
      },
    ],
    createdAt: '2026-08-27T15:00:00.000Z',
    updatedAt: '2026-08-27T15:00:00.000Z',
  };

  beforeEach(async () => {
    api = {
      list: vi.fn().mockReturnValue(
        of({
          data: [supplier],
          meta: {
            apiVersion: '1',
            pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
          },
        }),
      ),
      create: vi.fn(),
      update: vi.fn(),
      deactivate: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [SupplierPanelComponent],
      providers: [{ provide: SupplierApiService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(SupplierPanelComponent);
    fixture.detectChanges();
  });

  function fill(id: string, value: string): void {
    const input = fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  it('renders, filters and creates a supplier with a contact', () => {
    expect(api.list).toHaveBeenCalledWith({ status: 'ACTIVE', page: 1, pageSize: 10 });
    expect(fixture.nativeElement.textContent).toContain('Café Mayorista');
    expect(fixture.nativeElement.textContent).toContain('ana@proveedor.example');

    fill('supplierSearch', '  Ana  ');
    (fixture.componentInstance as unknown as { filter(): void }).filter();
    expect(api.list).toHaveBeenLastCalledWith({
      q: 'Ana',
      status: 'ACTIVE',
      page: 1,
      pageSize: 10,
    });

    fill('supplierLegalName', 'Proveedor Nuevo');
    fill('supplierTradeName', 'Nuevo');
    fill('supplierTaxIdentifier', 'DEF040506CD2');
    fill('supplierContactName0', 'Luis Ventas');
    fill('supplierContactEmail0', 'luis@example.com');
    const response = new Subject<{
      data: SupplierData;
      meta: { apiVersion: '1' };
    }>();
    api.create.mockReturnValue(response);

    (fixture.componentInstance as unknown as { submit(): void }).submit();
    (fixture.componentInstance as unknown as { submit(): void }).submit();

    expect(api.create).toHaveBeenCalledOnce();
    expect(api.create).toHaveBeenCalledWith({
      legalName: 'Proveedor Nuevo',
      tradeName: 'Nuevo',
      taxIdentifier: 'DEF040506CD2',
      contacts: [
        {
          name: 'Luis Ventas',
          email: 'luis@example.com',
          primary: false,
        },
      ],
    });
    response.next({
      data: { ...supplier, legalName: 'Proveedor Nuevo' },
      meta: { apiVersion: '1' },
    });
    response.complete();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Proveedor creado.');
    expect(api.list).toHaveBeenCalledTimes(3);
  });

  it('updates with optimistic version and deactivates without deleting history', () => {
    const buttons = fixture.nativeElement.querySelectorAll(
      '.results li button',
    ) as NodeListOf<HTMLButtonElement>;
    buttons[0].click();
    fixture.detectChanges();
    expect(
      (fixture.nativeElement.querySelector('#supplierLegalName') as HTMLInputElement).value,
    ).toBe(supplier.legalName);

    fill('supplierLegalName', 'Café Mayorista Actualizado');
    api.update.mockReturnValue(
      of({
        data: { ...supplier, legalName: 'Café Mayorista Actualizado', version: 2 },
        meta: { apiVersion: '1' },
      }),
    );
    (fixture.componentInstance as unknown as { submit(): void }).submit();

    expect(api.update).toHaveBeenCalledWith(
      supplier.id,
      expect.objectContaining({ legalName: 'Café Mayorista Actualizado', version: 1 }),
    );

    api.deactivate.mockReturnValue(
      of({ data: { ...supplier, active: false, version: 2 }, meta: { apiVersion: '1' } }),
    );
    (fixture.componentInstance as unknown as { deactivate(value: SupplierData): void }).deactivate(
      supplier,
    );
    fixture.detectChanges();

    expect(api.deactivate).toHaveBeenCalledWith(supplier.id);
    expect(fixture.nativeElement.textContent).toContain(
      'Proveedor desactivado; su historial se conserva.',
    );
  });
});
