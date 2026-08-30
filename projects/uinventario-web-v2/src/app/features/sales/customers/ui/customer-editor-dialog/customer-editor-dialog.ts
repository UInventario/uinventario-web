import { ChangeDetectionStrategy, Component, OnInit, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Customer, CustomerInput } from '../../domain/customer.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  selector: 'ui-customer-editor-dialog',
  styleUrl: '../customer-dialog.scss',
  templateUrl: './customer-editor-dialog.html',
})
export class CustomerEditorDialog implements OnInit {
  readonly customer = input<Customer | null>(null);
  readonly saving = input(false);
  readonly error = input<string | null>(null);
  readonly closed = output<void>();
  readonly submitted = output<CustomerInput>();

  protected readonly form = new FormBuilder().nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(160)]],
    identifier: ['', Validators.maxLength(80)],
    email: ['', [Validators.email, Validators.maxLength(254)]],
    phone: ['', Validators.pattern(/^\+?[0-9 ()-]{7,32}$/)],
    dataProcessingConsent: [false],
    active: [true],
  });

  ngOnInit(): void {
    const customer = this.customer();
    if (!customer) return;
    this.form.reset({
      name: customer.name,
      identifier: customer.identifier ?? '',
      email: customer.email ?? '',
      phone: customer.phone ?? '',
      dataProcessingConsent: customer.dataProcessingConsent,
      active: customer.active,
    });
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const consent = value.dataProcessingConsent;
    this.submitted.emit({
      name: value.name.trim(),
      identifier: value.identifier.trim() || undefined,
      email: consent ? value.email.trim().toLowerCase() || undefined : undefined,
      phone: consent ? value.phone.trim() || undefined : undefined,
      dataProcessingConsent: consent,
      active: value.active,
    });
  }
}
