import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, finalize } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { AccessFacade } from '../../application/access.facade';
import { PERMISSION_GROUPS, PermissionRisk } from '../../application/permission-catalog';
import {
  AccessBranch,
  AccessCashRegister,
  AccessRole,
  AccessUser,
  OperationalPermission,
} from '../../domain/access.models';
import { AccessMatrix } from '../access-matrix/access-matrix';
import { AccessUserTable } from '../access-user-table/access-user-table';

type ViewMode = 'USERS' | 'ROLES';
type EditorMode = 'CREATE_USER' | 'EDIT_USER' | 'CREATE_ROLE';
type StatusFilter = 'ACTIVE' | 'RETIRED' | 'ALL';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AccessMatrix, AccessUserTable, ReactiveFormsModule],
  selector: 'ui-access-page',
  styleUrl: './access-page.scss',
  templateUrl: './access-page.html',
})
export class AccessPage implements OnInit {
  private readonly access = inject(AccessFacade);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly permissionGroups = PERMISSION_GROUPS;
  protected readonly roles = signal<readonly AccessRole[]>([]);
  protected readonly users = signal<readonly AccessUser[]>([]);
  protected readonly branches = signal<readonly AccessBranch[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly view = signal<ViewMode>('USERS');
  protected readonly editor = signal<EditorMode | null>(null);
  protected readonly activeUser = signal<AccessUser | null>(null);
  protected readonly retirement = signal<AccessUser | null>(null);
  protected readonly search = signal('');
  protected readonly statusFilter = signal<StatusFilter>('ACTIVE');
  protected readonly selectionError = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly retirementConfirmation = signal('');

  protected readonly activeUsers = computed(
    () => this.users().filter((user) => user.active).length,
  );
  protected readonly retiredUsers = computed(
    () => this.users().filter((user) => !user.active).length,
  );
  protected readonly filteredUsers = computed(() => {
    const query = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    return this.users().filter(
      (user) =>
        (status === 'ALL' || (status === 'ACTIVE' ? user.active : !user.active)) &&
        (!query ||
          user.email.toLowerCase().includes(query) ||
          user.roles.some((role) => role.name.toLowerCase().includes(query)) ||
          user.branches.some((branch) => branch.name.toLowerCase().includes(query))),
    );
  });
  protected readonly canConfirmRetirement = computed(
    () =>
      this.retirementConfirmation().trim().toLowerCase() === this.retirement()?.email.toLowerCase(),
  );

  protected readonly userForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: [
      '',
      [
        Validators.required,
        Validators.minLength(12),
        Validators.maxLength(128),
        Validators.pattern(/[a-z]/),
        Validators.pattern(/[A-Z]/),
        Validators.pattern(/[0-9]/),
        Validators.pattern(/[^A-Za-z0-9]/),
      ],
    ],
    roleIds: [[] as string[]],
    branchIds: [[] as string[]],
    cashRegisterIds: [[] as string[]],
  });
  protected readonly roleForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    permissions: [[] as OperationalPermission[]],
  });

  ngOnInit(): void {
    this.load();
  }

  protected setView(view: ViewMode): void {
    this.view.set(view);
    this.clearMessages();
  }

  protected updateSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected updateStatus(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as StatusFilter);
  }

  protected openCreateUser(): void {
    this.clearMessages();
    this.activeUser.set(null);
    this.userForm.controls.email.enable();
    this.userForm.controls.password.setValidators([
      Validators.required,
      Validators.minLength(12),
      Validators.maxLength(128),
      Validators.pattern(/[a-z]/),
      Validators.pattern(/[A-Z]/),
      Validators.pattern(/[0-9]/),
      Validators.pattern(/[^A-Za-z0-9]/),
    ]);
    this.userForm.reset({
      email: '',
      password: '',
      roleIds: [],
      branchIds: [],
      cashRegisterIds: [],
    });
    this.editor.set('CREATE_USER');
  }

  protected openEditUser(user: AccessUser): void {
    if (!user.manageable) return;
    this.clearMessages();
    this.activeUser.set(user);
    this.userForm.reset({
      email: user.email,
      password: '',
      roleIds: user.roles.map((role) => role.id),
      branchIds: user.branches.map((branch) => branch.id),
      cashRegisterIds: user.cashRegisters.map((register) => register.id),
    });
    this.userForm.controls.email.disable();
    this.userForm.controls.password.clearValidators();
    this.userForm.controls.password.updateValueAndValidity();
    this.editor.set('EDIT_USER');
  }

  protected openCreateRole(): void {
    this.clearMessages();
    this.roleForm.reset({ name: '', permissions: [] });
    this.editor.set('CREATE_ROLE');
  }

  protected closeEditor(): void {
    if (!this.saving()) this.editor.set(null);
  }

  protected toggleUserSelection(
    field: 'roleIds' | 'branchIds' | 'cashRegisterIds',
    id: string,
    event: Event,
  ): void {
    const control = this.userForm.controls[field];
    const checked = (event.target as HTMLInputElement).checked;
    control.setValue(
      checked ? [...control.value, id] : control.value.filter((value) => value !== id),
    );
    if (field === 'branchIds' && !checked) {
      const allowed = new Set(
        this.registersForBranches(this.userForm.controls.branchIds.value).map(({ id }) => id),
      );
      this.userForm.controls.cashRegisterIds.setValue(
        this.userForm.controls.cashRegisterIds.value.filter((registerId) =>
          allowed.has(registerId),
        ),
      );
    }
    this.selectionError.set(null);
  }

  protected togglePermission(permission: OperationalPermission, event: Event): void {
    const control = this.roleForm.controls.permissions;
    const checked = (event.target as HTMLInputElement).checked;
    control.setValue(
      checked
        ? [...control.value, permission]
        : control.value.filter((value) => value !== permission),
    );
    this.selectionError.set(null);
  }

  protected saveEditor(): void {
    if (this.editor() === 'CREATE_ROLE') {
      this.saveRole();
      return;
    }
    this.saveUser();
  }

  protected requestRetirement(user: AccessUser): void {
    this.clearMessages();
    this.retirementConfirmation.set('');
    this.retirement.set(user);
  }

  protected cancelRetirement(): void {
    if (!this.saving()) this.retirement.set(null);
  }

  protected updateRetirementConfirmation(event: Event): void {
    this.retirementConfirmation.set((event.target as HTMLInputElement).value);
  }

  protected confirmRetirement(): void {
    const user = this.retirement();
    if (!user || !this.canConfirmRetirement() || this.saving()) return;
    this.mutate(
      this.access.retireUser(user.id, this.retirementConfirmation()),
      `Se retiró el acceso de ${user.email}.`,
      true,
    );
  }

  protected availableRegisters(): readonly AccessCashRegister[] {
    return this.registersForBranches(this.userForm.controls.branchIds.value);
  }

  protected isUserSelected(
    field: 'roleIds' | 'branchIds' | 'cashRegisterIds',
    id: string,
  ): boolean {
    return this.userForm.controls[field].value.includes(id);
  }

  protected isPermissionSelected(permission: OperationalPermission): boolean {
    return this.roleForm.controls.permissions.value.includes(permission);
  }

  protected riskLabel(risk: PermissionRisk): string {
    return { STANDARD: 'Estándar', ELEVATED: 'Elevado', CRITICAL: 'Crítico' }[risk];
  }

  private saveRole(): void {
    if (this.roleForm.invalid) {
      this.roleForm.markAllAsTouched();
      return;
    }
    const { name, permissions } = this.roleForm.getRawValue();
    if (!permissions.length) {
      this.selectionError.set('Selecciona al menos un permiso para el rol.');
      return;
    }
    this.mutate(this.access.createRole(name, permissions), `Se creó el rol ${name.trim()}.`);
  }

  private saveUser(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }
    const input = this.userForm.getRawValue();
    if (!input.roleIds.length || !input.branchIds.length) {
      this.selectionError.set('Selecciona al menos un rol y una sucursal.');
      return;
    }
    const current = this.activeUser();
    const request = current
      ? this.access.updateUser(current.id, input)
      : this.access.createUser(input);
    const message = current
      ? current.active
        ? `Se actualizó el acceso de ${current.email}.`
        : `Se reactivó el acceso de ${current.email}.`
      : `Se creó el acceso para ${input.email.trim().toLowerCase()}.`;
    this.mutate(request, message);
  }

  private mutate<T>(request: Observable<T>, message: string, retirement = false): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.clearMessages();
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.editor.set(null);
        if (retirement) this.retirement.set(null);
        this.successMessage.set(message);
        this.load(false);
      },
      error: (error: unknown) => this.errorMessage.set(this.messageFor(error)),
    });
  }

  private load(clearMessages = true): void {
    this.loading.set(true);
    if (clearMessages) this.clearMessages();
    this.access
      .load()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ roles, users, branches }) => {
          this.roles.set(roles);
          this.users.set(users);
          this.branches.set(branches.filter((branch) => branch.active));
        },
        error: (error: unknown) => this.errorMessage.set(this.messageFor(error)),
      });
  }

  private registersForBranches(branchIds: readonly string[]): readonly AccessCashRegister[] {
    const selected = new Set(branchIds);
    return this.branches()
      .filter((branch) => selected.has(branch.id))
      .flatMap((branch) => branch.cashRegisters);
  }

  private clearMessages(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.selectionError.set(null);
  }

  private messageFor(error: unknown): string {
    if (!(error instanceof ApiError)) return 'No fue posible actualizar los accesos.';
    if (error.code === 'ACCESS_USER_NOT_AVAILABLE') return 'El correo ya pertenece a otra cuenta.';
    if (error.code === 'INVALID_ACCESS_ASSIGNMENT')
      return 'La asignación ya no es válida. Actualiza la vista.';
    if (error.code === 'ACCESS_RETIREMENT_CONFIRMATION_INVALID')
      return 'El correo de confirmación no coincide.';
    if (error.kind === 'validation') return 'Revisa los campos marcados.';
    return error.message;
  }
}
