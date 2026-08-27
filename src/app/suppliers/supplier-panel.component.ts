import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import {
  SupplierApiService,
  SupplierContactInput,
  SupplierData,
  SupplierInput,
  SupplierStatusFilter,
} from './supplier-api.service';

@Component({
  selector: 'app-supplier-panel',
  imports: [ReactiveFormsModule],
  templateUrl: './supplier-panel.component.html',
  styleUrl: './supplier-panel.component.scss',
})
export class SupplierPanelComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly api = inject(SupplierApiService);

  protected readonly suppliers = signal<SupplierData[]>([]);
  protected readonly editing = signal<SupplierData | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly deactivatingId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly page = signal(1);
  protected readonly totalPages = signal(0);
  protected readonly total = signal(0);
  protected readonly searchForm = this.formBuilder.nonNullable.group({
    q: ['', [Validators.maxLength(100)]],
    status: ['ACTIVE' as SupplierStatusFilter],
  });
  protected readonly form = this.formBuilder.nonNullable.group({
    legalName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(180)]],
    tradeName: ['', [Validators.maxLength(180)]],
    taxIdentifier: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(64)]],
    contacts: this.formBuilder.array([this.contactGroup()]),
  });

  protected get contacts(): FormArray<ReturnType<SupplierPanelComponent['contactGroup']>> {
    return this.form.controls.contacts;
  }

  ngOnInit(): void {
    this.load(1);
  }

  protected addContact(): void {
    if (this.contacts.length < 20) this.contacts.push(this.contactGroup());
  }

  protected removeContact(index: number): void {
    if (this.contacts.length > 1) this.contacts.removeAt(index);
  }

  protected filter(): void {
    this.load(1);
  }

  protected previousPage(): void {
    if (this.page() > 1) this.load(this.page() - 1);
  }

  protected nextPage(): void {
    if (this.page() < this.totalPages()) this.load(this.page() + 1);
  }

  protected edit(supplier: SupplierData): void {
    this.editing.set(supplier);
    this.form.patchValue({
      legalName: supplier.legalName,
      tradeName: supplier.tradeName ?? '',
      taxIdentifier: supplier.taxIdentifier,
    });
    this.contacts.clear();
    for (const contact of supplier.contacts) {
      this.contacts.push(
        this.contactGroup({
          name: contact.name,
          email: contact.email ?? '',
          phone: contact.phone ?? '',
          role: contact.role ?? '',
          primary: contact.primary,
        }),
      );
    }
    if (this.contacts.length === 0) this.contacts.push(this.contactGroup());
    this.error.set(null);
    this.success.set(null);
  }

  protected cancelEditing(): void {
    this.editing.set(null);
    this.resetForm();
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const contacts = this.form.controls.contacts.getRawValue();
    const usableContacts = contacts.filter(
      (contact) => contact.email.trim() || contact.phone.trim(),
    );
    if (usableContacts.length !== contacts.length) {
      this.error.set('Cada contacto requiere correo o teléfono.');
      return;
    }
    if (usableContacts.filter((contact) => contact.primary).length > 1) {
      this.error.set('Sólo un contacto puede ser principal.');
      return;
    }
    const raw = this.form.getRawValue();
    const input: SupplierInput = {
      legalName: raw.legalName.trim(),
      ...(raw.tradeName.trim() ? { tradeName: raw.tradeName.trim() } : {}),
      taxIdentifier: raw.taxIdentifier.trim(),
      contacts: usableContacts.map((contact): SupplierContactInput => ({
        name: contact.name.trim(),
        ...(contact.email.trim() ? { email: contact.email.trim() } : {}),
        ...(contact.phone.trim() ? { phone: contact.phone.trim() } : {}),
        ...(contact.role.trim() ? { role: contact.role.trim() } : {}),
        primary: contact.primary,
      })),
    };
    const current = this.editing();
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    const operation = current
      ? this.api.update(current.id, { ...input, version: current.version })
      : this.api.create(input);
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.success.set(current ? 'Proveedor actualizado.' : 'Proveedor creado.');
        this.editing.set(null);
        this.resetForm();
        this.load(1);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(this.message(error));
        if (error.error?.code === 'SUPPLIER_VERSION_CONFLICT') this.load(this.page());
      },
    });
  }

  protected deactivate(supplier: SupplierData): void {
    if (!supplier.active || this.deactivatingId()) return;
    this.deactivatingId.set(supplier.id);
    this.error.set(null);
    this.success.set(null);
    this.api
      .deactivate(supplier.id)
      .pipe(finalize(() => this.deactivatingId.set(null)))
      .subscribe({
        next: () => {
          this.success.set('Proveedor desactivado; su historial se conserva.');
          if (this.editing()?.id === supplier.id) this.cancelEditing();
          this.load(1);
        },
        error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
      });
  }

  private load(page: number): void {
    this.loading.set(true);
    this.error.set(null);
    const search = this.searchForm.getRawValue();
    this.api
      .list({
        ...(search.q.trim() ? { q: search.q.trim() } : {}),
        status: search.status,
        page,
        pageSize: 10,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ data, meta }) => {
          this.suppliers.set(data);
          this.page.set(meta.pagination.page);
          this.totalPages.set(meta.pagination.totalPages);
          this.total.set(meta.pagination.total);
        },
        error: (error: HttpErrorResponse) => {
          this.suppliers.set([]);
          this.error.set(this.message(error));
        },
      });
  }

  private contactGroup(value?: Partial<SupplierContactInput>) {
    return this.formBuilder.nonNullable.group({
      name: [
        value?.name ?? '',
        [Validators.required, Validators.minLength(2), Validators.maxLength(120)],
      ],
      email: [value?.email ?? '', [Validators.email, Validators.maxLength(254)]],
      phone: [value?.phone ?? '', [Validators.maxLength(40)]],
      role: [value?.role ?? '', [Validators.maxLength(80)]],
      primary: [value?.primary ?? false],
    });
  }

  private resetForm(): void {
    this.form.reset({ legalName: '', tradeName: '', taxIdentifier: '' });
    this.contacts.clear();
    this.contacts.push(this.contactGroup());
  }

  private message(error: HttpErrorResponse): string {
    if (typeof error.error?.message === 'string') return error.error.message;
    if (error.status === 0) return 'No fue posible conectar con el servicio de proveedores.';
    return 'No fue posible completar la operación de proveedores.';
  }
}
