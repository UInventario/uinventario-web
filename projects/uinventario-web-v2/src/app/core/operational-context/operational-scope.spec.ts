import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SessionState } from '../session/session-state';
import { OperationalScope } from './operational-scope';

describe('OperationalScope', () => {
  const session = signal({
    tenant: { id: 'tenant-a' },
    context: {
      branch: { id: 'branch-a' },
      warehouse: { id: 'warehouse-a' },
      cashRegister: { id: 'register-a' },
    },
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: SessionState, useValue: { session } }],
    });
  });

  it('creates an isolation key containing every operational boundary', () => {
    const scope = TestBed.inject(OperationalScope);
    expect(scope.scopeKey()).toBe('tenant-a:branch-a:warehouse-a:register-a');

    session.update((current) => ({
      ...current,
      context: { ...current.context, branch: { id: 'branch-b' } },
    }));

    expect(scope.scopeKey()).toBe('tenant-a:branch-b:warehouse-a:register-a');
  });
});
