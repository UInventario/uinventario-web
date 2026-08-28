import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { CustomerApiService, CustomerData } from '../customers/customer-api.service';
import { PrivacyApiService, PrivacyPolicyData, PrivacyReportData } from './privacy-api.service';

@Component({
  selector: 'app-privacy-panel',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './privacy-panel.component.html',
  styleUrl: './privacy-panel.component.scss',
})
export class PrivacyPanelComponent implements OnInit {
  private readonly privacy = inject(PrivacyApiService);
  private readonly customersApi = inject(CustomerApiService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly loading = signal(true);
  protected readonly action = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly policy = signal<PrivacyPolicyData | null>(null);
  protected readonly classificationCodes = signal<string[]>([]);
  protected readonly customers = signal<CustomerData[]>([]);
  protected readonly selectedCustomer = signal<CustomerData | null>(null);
  protected readonly report = signal<PrivacyReportData | null>(null);

  protected readonly searchForm = this.formBuilder.nonNullable.group({ q: [''] });
  protected readonly policyForm = this.formBuilder.nonNullable.group({
    transactionRetentionDays: [365, [Validators.required, Validators.min(365)]],
    reason: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(240)]],
  });
  protected readonly holdForm = this.formBuilder.nonNullable.group({
    reason: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(240)]],
    requestReference: ['', Validators.maxLength(120)],
    expiresAt: [''],
  });
  protected readonly anonymizationForm = this.formBuilder.nonNullable.group({
    reason: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(240)]],
    requestReference: ['', Validators.maxLength(120)],
  });

  ngOnInit(): void {
    this.loadOverview();
  }

  protected search(): void {
    this.loading.set(true);
    this.error.set(null);
    this.customersApi
      .list({ q: this.searchForm.controls.q.value.trim(), status: 'ALL', page: 1, pageSize: 50 })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ data }) => this.customers.set(data),
        error: (error: HttpErrorResponse) => this.fail(error, 'No fue posible buscar clientes.'),
      });
  }

  protected select(customer: CustomerData): void {
    this.selectedCustomer.set(customer);
    this.report.set(null);
    this.loading.set(true);
    this.error.set(null);
    this.privacy
      .report(customer.id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ data }) => this.report.set(data),
        error: (error: HttpErrorResponse) =>
          this.fail(error, 'No fue posible consultar la privacidad del cliente.'),
      });
  }

  protected updatePolicy(): void {
    const current = this.policy();
    if (!current || this.policyForm.invalid || this.action()) {
      this.policyForm.markAllAsTouched();
      return;
    }
    const value = this.policyForm.getRawValue();
    this.runAction(
      'policy',
      this.privacy.updatePolicy(
        {
          expectedVersion: current.version,
          transactionRetentionDays: value.transactionRetentionDays,
          reason: value.reason.trim(),
        },
        this.key('policy'),
      ),
      ({ data }) => {
        this.policy.set(data);
        this.policyForm.patchValue({
          transactionRetentionDays: data.transactionRetentionDays,
          reason: '',
        });
        this.success.set('Política de retención actualizada.');
      },
    );
  }

  protected createLegalHold(): void {
    const customer = this.selectedCustomer();
    if (!customer || this.holdForm.invalid || this.action()) {
      this.holdForm.markAllAsTouched();
      return;
    }
    const value = this.holdForm.getRawValue();
    this.runAction(
      'hold',
      this.privacy.createLegalHold(
        customer.id,
        {
          reason: value.reason.trim(),
          ...(value.requestReference.trim()
            ? { requestReference: value.requestReference.trim() }
            : {}),
          ...(value.expiresAt ? { expiresAt: new Date(value.expiresAt).toISOString() } : {}),
        },
        this.key('hold'),
      ),
      () => {
        this.success.set('Bloqueo legal aplicado.');
        this.holdForm.reset({ reason: '', requestReference: '', expiresAt: '' });
        this.reloadReport(customer.id);
      },
    );
  }

  protected releaseLegalHold(): void {
    const customer = this.selectedCustomer();
    const value = this.holdForm.getRawValue();
    if (!customer || value.reason.trim().length < 8 || this.action()) {
      this.holdForm.controls.reason.markAsTouched();
      return;
    }
    this.runAction(
      'release',
      this.privacy.releaseLegalHold(
        customer.id,
        {
          reason: value.reason.trim(),
          ...(value.requestReference.trim()
            ? { requestReference: value.requestReference.trim() }
            : {}),
        },
        this.key('release'),
      ),
      () => {
        this.success.set('Bloqueo legal liberado.');
        this.holdForm.reset({ reason: '', requestReference: '', expiresAt: '' });
        this.reloadReport(customer.id);
      },
    );
  }

  protected anonymize(): void {
    const customer = this.selectedCustomer();
    if (!customer || this.anonymizationForm.invalid || this.action()) {
      this.anonymizationForm.markAllAsTouched();
      return;
    }
    if (
      !globalThis.confirm(
        'Se eliminarán identificador y contacto. Las ventas se conservarán. ¿Continuar?',
      )
    )
      return;
    const value = this.anonymizationForm.getRawValue();
    this.runAction(
      'anonymize',
      this.privacy.anonymize(
        customer.id,
        {
          reason: value.reason.trim(),
          ...(value.requestReference.trim()
            ? { requestReference: value.requestReference.trim() }
            : {}),
        },
        this.key('anonymize'),
      ),
      () => {
        this.success.set('Identidad del cliente anonimizada; sus ventas se conservaron.');
        this.anonymizationForm.reset({ reason: '', requestReference: '' });
        this.reloadReport(customer.id);
        this.search();
      },
    );
  }

  protected exportData(): void {
    const customer = this.selectedCustomer();
    if (!customer || this.action()) return;
    this.runAction('export', this.privacy.export(customer.id), (blob) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `cliente-${customer.id}-privacidad.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      this.success.set('Exportación de privacidad generada.');
    });
  }

  private loadOverview(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      classification: this.privacy.classification(),
      policy: this.privacy.policy(),
      customers: this.customersApi.list({ status: 'ALL', page: 1, pageSize: 50 }),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ classification, policy, customers }) => {
          this.classificationCodes.set(classification.data.classes.map(({ code }) => code));
          this.policy.set(policy.data);
          this.policyForm.patchValue({
            transactionRetentionDays: policy.data.transactionRetentionDays,
          });
          this.customers.set(customers.data);
        },
        error: (error: HttpErrorResponse) =>
          this.fail(error, 'No fue posible cargar la administración de privacidad.'),
      });
  }

  private reloadReport(customerId: string): void {
    this.privacy.report(customerId).subscribe({
      next: ({ data }) => {
        this.report.set(data);
        this.selectedCustomer.set(data.subject);
      },
      error: (error: HttpErrorResponse) =>
        this.fail(error, 'No fue posible actualizar el reporte de privacidad.'),
    });
  }

  private runAction<T>(
    action: string,
    operation: import('rxjs').Observable<T>,
    success: (result: T) => void,
  ): void {
    this.action.set(action);
    this.error.set(null);
    this.success.set(null);
    operation.pipe(finalize(() => this.action.set(null))).subscribe({
      next: success,
      error: (error: HttpErrorResponse) => this.fail(error, 'No fue posible completar la acción.'),
    });
  }

  private fail(error: HttpErrorResponse, fallback: string): void {
    this.error.set(typeof error.error?.message === 'string' ? error.error.message : fallback);
  }

  private key(operation: string): string {
    return `web-privacy-${operation}-${globalThis.crypto.randomUUID()}`;
  }
}
