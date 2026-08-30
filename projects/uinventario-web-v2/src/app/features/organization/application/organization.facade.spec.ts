import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { OperationalContextStore } from '../../../core/operational-context/operational-context.store';
import { OrganizationGateway } from '../domain/organization.gateway';
import { OrganizationFacade } from './organization.facade';

describe('OrganizationFacade', () => {
  const gateway = {
    getCompany: vi.fn(),
    configureCompany: vi.fn(),
    getInitialLocation: vi.fn(),
    configureInitialLocation: vi.fn(),
    getInitialCashRegister: vi.fn(),
    configureInitialCashRegister: vi.fn(),
    listBranches: vi.fn(),
    createBranch: vi.fn(),
    updateBranch: vi.fn(),
    retireBranch: vi.fn(),
    createWarehouse: vi.fn(),
    updateWarehouse: vi.fn(),
    retireWarehouse: vi.fn(),
    createCashRegister: vi.fn(),
  };
  const context = { load: vi.fn() };
  let facade: OrganizationFacade;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        OrganizationFacade,
        { provide: OrganizationGateway, useValue: gateway },
        { provide: OperationalContextStore, useValue: context },
      ],
    });
    facade = TestBed.inject(OrganizationFacade);
  });

  it('normalizes company and initial operation inputs at its boundary', () => {
    gateway.configureCompany.mockReturnValue(of({}));
    gateway.configureInitialLocation.mockReturnValue(of({}));

    facade
      .configureCompany({
        legalName: '  Comercializadora Uno  ',
        tradeName: '  Tienda Uno ',
        countryCode: ' mx ',
      })
      .subscribe();
    facade
      .configureInitialLocation({
        branchName: ' Centro ',
        timezone: ' America/Mexico_City ',
        warehouseName: ' Principal ',
        locationName: ' General ',
      })
      .subscribe();

    expect(gateway.configureCompany).toHaveBeenCalledWith({
      legalName: 'Comercializadora Uno',
      tradeName: 'Tienda Uno',
      countryCode: 'MX',
    });
    expect(gateway.configureInitialLocation).toHaveBeenCalledWith({
      branchName: 'Centro',
      timezone: 'America/Mexico_City',
      warehouseName: 'Principal',
      locationName: 'General',
    });
  });

  it('normalizes operation codes and refreshes the shared context explicitly', () => {
    gateway.createBranch.mockReturnValue(of({}));
    gateway.createCashRegister.mockReturnValue(of({}));
    context.load.mockReturnValue(of([]));

    facade
      .createBranch({
        name: ' Norte ',
        timezone: ' America/Mexico_City ',
        warehouseName: ' Bodega Norte ',
        locationName: ' Piso 1 ',
        locationCode: ' norte_1 ',
      })
      .subscribe();
    facade.createCashRegister('branch-1', ' Caja Norte ', ' caja_norte ').subscribe();
    facade.refreshOperationalContext().subscribe();

    expect(gateway.createBranch).toHaveBeenCalledWith({
      name: 'Norte',
      timezone: 'America/Mexico_City',
      warehouseName: 'Bodega Norte',
      locationName: 'Piso 1',
      locationCode: 'NORTE_1',
    });
    expect(gateway.createCashRegister).toHaveBeenCalledWith('branch-1', {
      name: 'Caja Norte',
      code: 'CAJA_NORTE',
    });
    expect(context.load).toHaveBeenCalledWith(true);
  });
});
