import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AccessGateway } from '../domain/access.gateway';
import { AccessFacade } from './access.facade';

describe('AccessFacade', () => {
  const gateway = {
    listRoles: vi.fn(),
    listUsers: vi.fn(),
    listBranches: vi.fn(),
    createRole: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    retireUser: vi.fn(),
  };
  let facade: AccessFacade;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [AccessFacade, { provide: AccessGateway, useValue: gateway }],
    });
    facade = TestBed.inject(AccessFacade);
  });

  it('normalizes role, user and contextual confirmation inputs', () => {
    gateway.createRole.mockReturnValue(of({}));
    gateway.createUser.mockReturnValue(of({}));
    gateway.retireUser.mockReturnValue(of({}));

    facade.createRole('  Cajero  ', ['SALES_MANAGE', 'CASH_REGISTER_OPEN']).subscribe();
    facade
      .createUser({
        email: '  OPERATOR@EXAMPLE.COM ',
        password: 'Secure-password1!',
        roleIds: ['role-1', 'role-1'],
        branchIds: ['branch-1', 'branch-1'],
        cashRegisterIds: [],
      })
      .subscribe();
    facade.retireUser('user-1', ' OPERATOR@EXAMPLE.COM ').subscribe();

    expect(gateway.createRole).toHaveBeenCalledWith('Cajero', [
      'CASH_REGISTER_OPEN',
      'SALES_MANAGE',
    ]);
    expect(gateway.createUser).toHaveBeenCalledWith({
      email: 'operator@example.com',
      password: 'Secure-password1!',
      roleIds: ['role-1'],
      branchIds: ['branch-1'],
      cashRegisterIds: [],
    });
    expect(gateway.retireUser).toHaveBeenCalledWith('user-1', 'operator@example.com');
  });

  it('loads roles, users and operating branches as one view snapshot', () => {
    gateway.listRoles.mockReturnValue(of([{ id: 'role-1' }]));
    gateway.listUsers.mockReturnValue(of([{ id: 'user-1' }]));
    gateway.listBranches.mockReturnValue(of([{ id: 'branch-1' }]));

    facade.load().subscribe((snapshot) => {
      expect(snapshot).toEqual({
        roles: [{ id: 'role-1' }],
        users: [{ id: 'user-1' }],
        branches: [{ id: 'branch-1' }],
      });
    });
  });
});
