import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { PasswordResetApiService } from './password-reset-api.service';

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value as string | undefined;
  const confirmation = control.get('passwordConfirmation')?.value as string | undefined;
  return password === confirmation ? null : { passwordsMismatch: true };
}

@Component({
  selector: 'app-password-reset-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './password-reset.page.html',
  styleUrl: './login.page.scss',
})
export class PasswordResetPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly api = inject(PasswordResetApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly routeData = toSignal(this.route.data, {
    initialValue: this.route.snapshot.data,
  });
  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  protected readonly mode = computed(() => this.routeData()['mode'] as 'request' | 'complete');
  protected readonly token = computed(() => this.queryParams().get('token'));
  protected readonly submitting = signal(false);
  protected readonly completed = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly requestForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
  });
  protected readonly completeForm = this.formBuilder.nonNullable.group(
    {
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

  protected submitRequest(): void {
    if (this.requestForm.invalid || this.submitting()) {
      this.requestForm.markAllAsTouched();
      return;
    }

    this.beginRequest();
    this.api
      .request(this.requestForm.getRawValue().email)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => this.completed.set(true),
        error: (error: HttpErrorResponse) => {
          this.errorMessage.set(
            error.status === 0
              ? 'No pudimos conectar con el servicio. Intenta nuevamente.'
              : 'No fue posible procesar la solicitud. Intenta nuevamente.',
          );
        },
      });
  }

  protected submitComplete(): void {
    const token = this.token();
    if (!token || this.completeForm.invalid || this.submitting()) {
      this.completeForm.markAllAsTouched();
      if (!token) {
        this.errorMessage.set('El enlace no es válido o expiró. Solicita uno nuevo.');
      }
      return;
    }

    this.beginRequest();
    this.api
      .complete(token, this.completeForm.getRawValue().password)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => this.completed.set(true),
        error: (error: HttpErrorResponse) => {
          this.errorMessage.set(
            error.status === 0
              ? 'No pudimos conectar con el servicio. Intenta nuevamente.'
              : 'El enlace no es válido o expiró. Solicita uno nuevo.',
          );
        },
      });
  }

  private beginRequest(): void {
    this.submitting.set(true);
    this.errorMessage.set(null);
  }
}
