import { NgTemplateOutlet } from '@angular/common';
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
import { OrganizationFacade } from '../../application/organization.facade';
import { timezoneOptions } from '../../application/organization-options';
import { OrganizationBranch, OrganizationWarehouse } from '../../domain/organization.models';

type EditorMode =
  'CREATE_BRANCH' | 'EDIT_BRANCH' | 'CREATE_WAREHOUSE' | 'EDIT_WAREHOUSE' | 'CREATE_REGISTER';

interface RetirementCandidate {
  readonly type: 'BRANCH' | 'WAREHOUSE';
  readonly id: string;
  readonly name: string;
}

const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{1,39}$/;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, ReactiveFormsModule],
  selector: 'ui-organization-page',
  styleUrls: ['./organization-page.scss', './organization-dialog.scss'],
  templateUrl: './organization-page.html',
})
export class OrganizationPage implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly organization = inject(OrganizationFacade);

  protected readonly timezones = timezoneOptions();
  protected readonly branches = signal<readonly OrganizationBranch[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly editorMode = signal<EditorMode | null>(null);
  protected readonly activeBranch = signal<OrganizationBranch | null>(null);
  protected readonly activeWarehouse = signal<OrganizationWarehouse | null>(null);
  protected readonly retirement = signal<RetirementCandidate | null>(null);
  protected readonly retirementConfirmation = signal('');
  protected readonly canConfirmRetirement = computed(
    () => this.retirementConfirmation().trim() === this.retirement()?.name,
  );

  protected readonly branchForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    timezone: [this.defaultTimezone(), Validators.required],
    warehouseName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    locationName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    locationCode: ['', [Validators.required, Validators.pattern(CODE_PATTERN)]],
  });
  protected readonly warehouseForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    locationName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    locationCode: ['', [Validators.required, Validators.pattern(CODE_PATTERN)]],
  });
  protected readonly registerForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    code: ['', [Validators.required, Validators.pattern(CODE_PATTERN)]],
  });

  ngOnInit(): void {
    this.load();
  }

  protected openCreateBranch(): void {
    this.clearMessages();
    this.activeBranch.set(null);
    this.branchForm.reset({
      name: '',
      timezone: this.defaultTimezone(),
      warehouseName: 'Bodega principal',
      locationName: 'Ubicación general',
      locationCode: '',
    });
    this.editorMode.set('CREATE_BRANCH');
  }

  protected openEditBranch(branch: OrganizationBranch): void {
    this.clearMessages();
    this.activeBranch.set(branch);
    this.branchForm.reset({
      name: branch.name,
      timezone: branch.timezone,
      warehouseName: '',
      locationName: '',
      locationCode: '',
    });
    this.editorMode.set('EDIT_BRANCH');
  }

  protected openCreateWarehouse(branch: OrganizationBranch): void {
    this.clearMessages();
    this.activeBranch.set(branch);
    this.activeWarehouse.set(null);
    this.warehouseForm.reset({ name: '', locationName: 'Ubicación general', locationCode: '' });
    this.editorMode.set('CREATE_WAREHOUSE');
  }

  protected openEditWarehouse(branch: OrganizationBranch, warehouse: OrganizationWarehouse): void {
    this.clearMessages();
    this.activeBranch.set(branch);
    this.activeWarehouse.set(warehouse);
    this.warehouseForm.reset({ name: warehouse.name, locationName: '', locationCode: '' });
    this.editorMode.set('EDIT_WAREHOUSE');
  }

  protected openCreateRegister(branch: OrganizationBranch): void {
    this.clearMessages();
    this.activeBranch.set(branch);
    this.registerForm.reset({ name: '', code: '' });
    this.editorMode.set('CREATE_REGISTER');
  }

  protected closeEditor(): void {
    if (!this.saving()) this.editorMode.set(null);
  }

  protected saveEditor(): void {
    const mode = this.editorMode();
    if (!mode || this.saving()) return;
    if (mode === 'CREATE_BRANCH') {
      if (!this.valid(this.branchForm)) return;
      this.mutate(
        this.organization.createBranch(this.branchForm.getRawValue()),
        'Sucursal y bodega creadas.',
      );
      return;
    }
    if (mode === 'EDIT_BRANCH') {
      if (
        this.branchForm.controls.name.invalid ||
        this.branchForm.controls.timezone.invalid ||
        !this.activeBranch()
      ) {
        this.branchForm.controls.name.markAsTouched();
        this.branchForm.controls.timezone.markAsTouched();
        return;
      }
      const { name, timezone } = this.branchForm.getRawValue();
      this.mutate(
        this.organization.updateBranch(this.activeBranch()!.id, name, timezone),
        'Sucursal actualizada.',
      );
      return;
    }
    if (mode === 'CREATE_WAREHOUSE') {
      if (!this.valid(this.warehouseForm) || !this.activeBranch()) return;
      this.mutate(
        this.organization.createWarehouse(
          this.activeBranch()!.id,
          this.warehouseForm.getRawValue(),
        ),
        'Bodega y ubicación creadas.',
      );
      return;
    }
    if (mode === 'EDIT_WAREHOUSE') {
      if (this.warehouseForm.controls.name.invalid || !this.activeWarehouse()) {
        this.warehouseForm.controls.name.markAsTouched();
        return;
      }
      this.mutate(
        this.organization.updateWarehouse(
          this.activeWarehouse()!.id,
          this.warehouseForm.getRawValue().name,
        ),
        'Bodega actualizada.',
      );
      return;
    }
    if (!this.valid(this.registerForm) || !this.activeBranch()) return;
    const { name, code } = this.registerForm.getRawValue();
    this.mutate(
      this.organization.createCashRegister(this.activeBranch()!.id, name, code),
      'Caja creada.',
    );
  }

  protected requestRetirement(candidate: RetirementCandidate): void {
    this.clearMessages();
    this.retirementConfirmation.set('');
    this.retirement.set(candidate);
  }

  protected updateRetirementConfirmation(event: Event): void {
    this.retirementConfirmation.set((event.target as HTMLInputElement).value);
  }

  protected cancelRetirement(): void {
    if (!this.saving()) this.retirement.set(null);
  }

  protected confirmRetirement(): void {
    const candidate = this.retirement();
    if (!candidate || !this.canConfirmRetirement() || this.saving()) return;
    const request =
      candidate.type === 'BRANCH'
        ? this.organization.retireBranch(candidate.id)
        : this.organization.retireWarehouse(candidate.id);
    this.mutate(request, `${candidate.name} se retiró de la operación.`, true);
  }

  protected editorTitle(): string {
    return {
      CREATE_BRANCH: 'Nueva sucursal',
      EDIT_BRANCH: 'Editar sucursal',
      CREATE_WAREHOUSE: 'Nueva bodega',
      EDIT_WAREHOUSE: 'Editar bodega',
      CREATE_REGISTER: 'Nueva caja',
    }[this.editorMode() ?? 'CREATE_BRANCH'];
  }

  protected isBranchEditor(): boolean {
    return this.editorMode() === 'CREATE_BRANCH' || this.editorMode() === 'EDIT_BRANCH';
  }

  protected isWarehouseEditor(): boolean {
    return this.editorMode() === 'CREATE_WAREHOUSE' || this.editorMode() === 'EDIT_WAREHOUSE';
  }

  protected isCreateMode(): boolean {
    return this.editorMode()?.startsWith('CREATE_') ?? false;
  }

  private load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.organization
      .listBranches()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (branches) => this.branches.set(branches),
        error: (error: unknown) => this.errorMessage.set(this.messageFor(error)),
      });
  }

  private mutate<T>(request: Observable<T>, success: string, retirement = false): void {
    this.saving.set(true);
    this.clearMessages();
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.editorMode.set(null);
        if (retirement) this.retirement.set(null);
        this.successMessage.set(success);
        this.reloadAfterMutation();
        this.organization.refreshOperationalContext().subscribe({ error: () => undefined });
      },
      error: (error: unknown) => this.errorMessage.set(this.messageFor(error)),
    });
  }

  private reloadAfterMutation(): void {
    this.loading.set(true);
    this.organization
      .listBranches()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (branches) => this.branches.set(branches),
        error: () =>
          this.errorMessage.set(
            'El cambio se guardó, pero no fue posible actualizar la vista. Recarga la página.',
          ),
      });
  }

  private valid(form: { invalid: boolean; markAllAsTouched(): void }): boolean {
    if (!form.invalid) return true;
    form.markAllAsTouched();
    return false;
  }

  private clearMessages(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  private messageFor(error: unknown): string {
    if (!(error instanceof ApiError)) return 'No fue posible actualizar la organización.';
    if (error.code === 'ORGANIZATION_NAME_CONFLICT') {
      return 'Ya existe un elemento activo con ese nombre o código.';
    }
    if (error.code === 'INITIAL_ORGANIZATION_TARGET') {
      return 'La sucursal o bodega inicial no puede retirarse.';
    }
    if (error.code === 'ORGANIZATION_IN_USE') {
      return 'No puede retirarse porque tiene operaciones o asignaciones activas.';
    }
    if (error.kind === 'validation') return 'Revisa los campos marcados.';
    return error.message;
  }

  private defaultTimezone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  }
}
