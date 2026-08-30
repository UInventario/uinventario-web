import { Injectable, effect, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, tap, throwError } from 'rxjs';
import { ApiError } from '../api/api-error';
import { SessionData } from '../session/session.models';
import { SessionManager } from '../session/session-manager';
import { SessionState } from '../session/session-state';
import { OperationalContextApi } from './operational-context-api';
import { OperationalBranch, OperationalContextSelection } from './operational-context.models';

@Injectable({ providedIn: 'root' })
export class OperationalContextStore {
  private readonly api = inject(OperationalContextApi);
  private readonly manager = inject(SessionManager);
  private readonly sessions = inject(SessionState);
  private readonly availableBranches = signal<readonly OperationalBranch[]>([]);
  private readonly loadingState = signal(false);
  private readonly switchingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private loadedTenantId: string | null = null;
  private loadRevision = 0;

  readonly branches = this.availableBranches.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly switching = this.switchingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  constructor() {
    effect(() => {
      const tenantId = this.sessions.session()?.tenant.id ?? null;
      if (tenantId !== this.loadedTenantId) this.reset(tenantId);
    });
  }

  load(force = false): Observable<readonly OperationalBranch[]> {
    const tenantId = this.sessions.session()?.tenant.id ?? null;
    if (!tenantId) return of([]);
    if (!force && this.loadedTenantId === tenantId && this.branches().length) {
      return of(this.branches());
    }

    this.loadingState.set(true);
    this.errorState.set(null);
    const revision = ++this.loadRevision;
    return this.api.listBranches().pipe(
      map((response) => response.data.filter((branch) => branch.active)),
      map((branches) =>
        revision === this.loadRevision && this.sessions.session()?.tenant.id === tenantId
          ? branches
          : [],
      ),
      tap((branches) => {
        if (revision !== this.loadRevision || this.sessions.session()?.tenant.id !== tenantId)
          return;
        this.loadedTenantId = tenantId;
        this.availableBranches.set(branches);
      }),
      catchError((error: unknown) => {
        if (revision === this.loadRevision) this.errorState.set(this.messageFor(error));
        return throwError(() => error);
      }),
      finalize(() => {
        if (revision === this.loadRevision) this.loadingState.set(false);
      }),
    );
  }

  change(selection: OperationalContextSelection): Observable<SessionData> {
    const current = this.sessions.session();
    if (!current) return throwError(() => new Error('No existe una sesión activa.'));
    if (!this.isAuthorizedSelection(selection)) {
      const error = new Error('El contexto seleccionado no está disponible para esta cuenta.');
      this.errorState.set(error.message);
      return throwError(() => error);
    }
    if (this.isCurrent(current, selection)) return of(current);

    this.switchingState.set(true);
    this.errorState.set(null);
    return this.manager.changeContext(selection).pipe(
      catchError((error: unknown) => {
        this.errorState.set(this.messageFor(error));
        return throwError(() => error);
      }),
      finalize(() => this.switchingState.set(false)),
    );
  }

  private isAuthorizedSelection(selection: OperationalContextSelection): boolean {
    const branch = this.branches().find(
      (candidate) => candidate.active && candidate.id === selection.branchId,
    );
    const warehouse = branch?.warehouses.find(
      (candidate) => candidate.active && candidate.id === selection.warehouseId,
    );
    const registerValid =
      !selection.cashRegisterId ||
      branch?.cashRegisters.some((candidate) => candidate.id === selection.cashRegisterId);
    return Boolean(branch && warehouse && registerValid);
  }

  private isCurrent(session: SessionData, selection: OperationalContextSelection): boolean {
    return (
      session.context.branch?.id === selection.branchId &&
      session.context.warehouse?.id === selection.warehouseId &&
      (session.context.cashRegister?.id ?? undefined) === selection.cashRegisterId
    );
  }

  private reset(tenantId: string | null): void {
    this.loadRevision += 1;
    this.loadedTenantId = tenantId;
    this.availableBranches.set([]);
    this.loadingState.set(false);
    this.errorState.set(null);
  }

  private messageFor(error: unknown): string {
    if (error instanceof ApiError) return error.message;
    return 'No fue posible actualizar el contexto operativo.';
  }
}
