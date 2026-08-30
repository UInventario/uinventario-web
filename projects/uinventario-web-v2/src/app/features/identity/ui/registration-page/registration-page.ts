import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ApiError } from '../../../../core/api/api-error';
import { PASSWORD_VALIDATORS, passwordsMatch } from '../../application/credential-validators';
import { IdentityFacade } from '../../application/identity.facade';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, InputTextModule, ReactiveFormsModule, RouterLink],
  selector: 'ui-registration-page',
  styleUrl: '../auth-page.scss',
  templateUrl: './registration-page.html',
})
export class RegistrationPage {
  private readonly identity = inject(IdentityFacade);
  private readonly formBuilder = inject(FormBuilder);
  private idempotencyKey = this.newIdempotencyKey();

  protected readonly completed = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly form = this.formBuilder.nonNullable.group(
    {
      organizationName: [
        '',
        [Validators.required, Validators.minLength(2), Validators.maxLength(120)],
      ],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
      password: ['', PASSWORD_VALIDATORS],
      passwordConfirmation: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.form.valueChanges.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => {
      if (this.submitting()) return;
      this.idempotencyKey = this.newIdempotencyKey();
      this.errorMessage.set(null);
    });
  }

  protected submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    const { organizationName, email, password } = this.form.getRawValue();
    this.identity
      .register({ organizationName, email, password }, this.idempotencyKey)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => this.completed.set(true),
        error: (error: ApiError) => this.errorMessage.set(this.messageFor(error)),
      });
  }

  private messageFor(error: ApiError): string {
    if (error.kind === 'conflict') {
      return 'No pudimos crear la cuenta con esos datos. Si ya te registraste, inicia sesión o recupera tu contraseña.';
    }
    if (error.kind === 'validation') return 'Revisa los campos marcados e intenta de nuevo.';
    return error.message;
  }

  private newIdempotencyKey(): string {
    return `registration:${crypto.randomUUID()}`;
  }
}
