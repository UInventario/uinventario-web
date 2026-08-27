import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { RegistrationApiService } from './registration-api.service';

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value as string | undefined;
  const confirmation = control.get('passwordConfirmation')?.value as string | undefined;
  return password === confirmation ? null : { passwordsMismatch: true };
}

@Component({
  selector: 'app-registration-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './registration.page.html',
  styleUrl: './registration.page.scss',
})
export class RegistrationPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly api = inject(RegistrationApiService);
  private readonly router = inject(Router);
  private idempotencyKey = crypto.randomUUID();

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly form = this.formBuilder.nonNullable.group(
    {
      organizationName: [
        '',
        [Validators.required, Validators.minLength(2), Validators.maxLength(120)],
      ],
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
      passwordConfirmation: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.form.valueChanges.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => {
      if (!this.submitting()) {
        this.idempotencyKey = crypto.randomUUID();
        this.errorMessage.set(null);
      }
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

    this.api
      .register({ organizationName, email, password }, this.idempotencyKey)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          void this.router.navigate(['/login'], {
            state: { registrationComplete: true },
          });
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage.set(
            error.status === 0
              ? 'No pudimos conectar con el servicio. Intenta nuevamente.'
              : 'No fue posible crear la cuenta con esos datos.',
          );
        },
      });
  }
}
