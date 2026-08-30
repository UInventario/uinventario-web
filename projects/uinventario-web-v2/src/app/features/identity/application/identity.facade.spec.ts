import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { IdentityGateway } from '../domain/identity.gateway';
import { IdentityFacade } from './identity.facade';

describe('IdentityFacade', () => {
  const gateway = {
    register: vi.fn(() =>
      of({ tenantId: 'tenant', tenantName: 'Empresa', userId: 'user', email: '' }),
    ),
    requestPasswordReset: vi.fn(() => of(undefined)),
    completePasswordReset: vi.fn(() => of(undefined)),
  };

  beforeEach(() => {
    gateway.register.mockClear();
    gateway.requestPasswordReset.mockClear();
    TestBed.configureTestingModule({
      providers: [IdentityFacade, { provide: IdentityGateway, useValue: gateway }],
    });
  });

  it('normalizes registration identity fields before transport', () => {
    TestBed.inject(IdentityFacade)
      .register(
        { organizationName: '  Empresa Uno  ', email: ' Admin@Example.COM ', password: 'Secret' },
        'registration:key',
      )
      .subscribe();
    expect(gateway.register).toHaveBeenCalledWith(
      { organizationName: 'Empresa Uno', email: 'admin@example.com', password: 'Secret' },
      'registration:key',
    );
  });

  it('normalizes recovery email without revealing account existence', () => {
    TestBed.inject(IdentityFacade).requestPasswordReset(' User@Example.COM ').subscribe();
    expect(gateway.requestPasswordReset).toHaveBeenCalledWith('user@example.com');
  });
});
