import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SessionState } from '../session/session-state';
import { AuthorizationService } from './authorization.service';

describe('AuthorizationService', () => {
  const session = signal({
    user: { permissions: ['INVENTORY_VIEW', 'INVENTORY_COUNT'] },
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: SessionState, useValue: { session } }],
    });
  });

  it('evaluates effective server permissions with any and all semantics', () => {
    const authorization = TestBed.inject(AuthorizationService);

    expect(authorization.has('INVENTORY_VIEW')).toBe(true);
    expect(authorization.hasAny(['SALES_MANAGE', 'INVENTORY_COUNT'])).toBe(true);
    expect(authorization.hasAll(['INVENTORY_VIEW', 'INVENTORY_COUNT'])).toBe(true);
    expect(authorization.hasAll(['INVENTORY_VIEW', 'INVENTORY_ADJUST'])).toBe(false);
  });
});
