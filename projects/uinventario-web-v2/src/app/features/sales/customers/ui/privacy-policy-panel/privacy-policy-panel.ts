import { ChangeDetectionStrategy, Component, OnInit, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PrivacyPolicy, PrivacyPolicyInput } from '../../domain/customer.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  selector: 'ui-privacy-policy-panel',
  styleUrl: './privacy-policy-panel.scss',
  templateUrl: './privacy-policy-panel.html',
})
export class PrivacyPolicyPanel implements OnInit {
  readonly policy = input.required<PrivacyPolicy>();
  readonly saving = input(false);
  readonly error = input<string | null>(null);
  readonly submitted = output<PrivacyPolicyInput>();

  protected readonly form = new FormBuilder().nonNullable.group({
    transactionRetentionDays: [
      365,
      [Validators.required, Validators.min(365), Validators.max(36500)],
    ],
    reason: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(240)]],
    requestReference: ['', Validators.maxLength(120)],
  });

  ngOnInit(): void {
    this.form.controls.transactionRetentionDays.setValue(this.policy().transactionRetentionDays);
    this.form.controls.transactionRetentionDays.addValidators(
      Validators.min(this.policy().minimumTransactionRetentionDays),
    );
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.submitted.emit({
      transactionRetentionDays: value.transactionRetentionDays,
      expectedVersion: this.policy().version,
      reason: value.reason.trim(),
      requestReference: value.requestReference.trim() || undefined,
    });
  }
}
