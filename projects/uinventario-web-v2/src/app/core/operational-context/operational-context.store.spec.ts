import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { SessionManager } from '../session/session-manager';
import { SessionState } from '../session/session-state';
import { OperationalContextApi } from './operational-context-api';
import { OperationalContextStore } from './operational-context.store';

describe('OperationalContextStore', () => {
  const currentSession = {
    user: { id: 'user-1', email: 'a@example.com', roles: [], permissions: [] },
    tenant: { id: 'tenant-a', name: 'Empresa A' },
    context: {
      branch: { id: 'branch-a', name: 'Centro' },
      warehouse: { id: 'warehouse-a', name: 'Principal' },
      cashRegister: null,
    },
    nextStep: 'APPLICATION' as const,
  };
  const session = signal(currentSession);
  const branches = [
    {
      id: 'branch-a',
      name: 'Centro',
      timezone: 'America/Mexico_City',
      active: true,
      warehouses: [{ id: 'warehouse-a', name: 'Principal', active: true, locations: [] }],
      cashRegisters: [{ id: 'register-a', name: 'Caja 1', code: 'C1' }],
    },
    {
      id: 'branch-retired',
      name: 'Retirada',
      timezone: 'UTC',
      active: false,
      warehouses: [],
      cashRegisters: [],
    },
  ];
  const api = {
    listBranches: vi.fn(() => of({ data: branches, meta: { apiVersion: '1' } })),
  };
  const manager = {
    changeContext: vi.fn(() => of(currentSession)),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    session.set(currentSession);
    TestBed.configureTestingModule({
      providers: [
        OperationalContextStore,
        { provide: SessionState, useValue: { session } },
        { provide: OperationalContextApi, useValue: api },
        { provide: SessionManager, useValue: manager },
      ],
    });
  });

  it('loads only authorized active branches and reuses the tenant-scoped result', () => {
    const store = TestBed.inject(OperationalContextStore);
    store.load().subscribe();
    store.load().subscribe();

    expect(store.branches().map(({ id }) => id)).toEqual(['branch-a']);
    expect(api.listBranches).toHaveBeenCalledTimes(1);
  });

  it('changes only to a listed branch and warehouse', () => {
    const store = TestBed.inject(OperationalContextStore);
    store.load().subscribe();
    store
      .change({
        branchId: 'branch-a',
        warehouseId: 'warehouse-a',
        cashRegisterId: 'register-a',
      })
      .subscribe();

    expect(manager.changeContext).toHaveBeenCalledWith({
      branchId: 'branch-a',
      warehouseId: 'warehouse-a',
      cashRegisterId: 'register-a',
    });
    expect(api.listBranches).toHaveBeenCalledTimes(1);
  });

  it('rejects a context outside the server-provided tenant scope', () => {
    const store = TestBed.inject(OperationalContextStore);
    store.load().subscribe();

    let rejection: unknown;
    store
      .change({ branchId: 'foreign', warehouseId: 'foreign' })
      .subscribe({ error: (error: unknown) => (rejection = error) });
    expect(rejection).toBeInstanceOf(Error);
    expect((rejection as Error).message).toBe(
      'El contexto seleccionado no está disponible para esta cuenta.',
    );
    expect(manager.changeContext).not.toHaveBeenCalled();
  });

  it('clears tenant-scoped options before another tenant can load', () => {
    const store = TestBed.inject(OperationalContextStore);
    store.load().subscribe();
    expect(store.branches()).toHaveLength(1);

    session.set({
      ...currentSession,
      tenant: { id: 'tenant-b', name: 'Empresa B' },
    });
    TestBed.flushEffects();

    expect(store.branches()).toEqual([]);
    store.load().subscribe();
    expect(api.listBranches).toHaveBeenCalledTimes(2);
  });

  it('discards a late response from the previous tenant', () => {
    const staleResponse = new Subject<{
      data: typeof branches;
      meta: { apiVersion: string };
    }>();
    api.listBranches.mockReturnValueOnce(staleResponse);
    const store = TestBed.inject(OperationalContextStore);
    store.load().subscribe();

    session.set({
      ...currentSession,
      tenant: { id: 'tenant-b', name: 'Empresa B' },
    });
    TestBed.flushEffects();
    staleResponse.next({ data: branches, meta: { apiVersion: '1' } });
    staleResponse.complete();

    expect(store.branches()).toEqual([]);
  });
});
