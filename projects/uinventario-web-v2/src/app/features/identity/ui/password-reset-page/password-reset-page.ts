import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ApiError } from '../../../../core/api/api-error';
import {
  PASSWORD_VALIDATORS,
  passwordsMatch,
  validPasswordResetToken,
} from '../../application/credential-validators';
import { IdentityFacade } from '../../application/identity.facade';

type PasswordResetMode = 'request' | 'complete';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, InputTextModule, ReactiveFormsModule, RouterLink],
  selector: 'ui-password-reset-page',
  styleUrl: '../auth-page.scss',
  templateUrl: './password-reset-page.html',
})
export class PasswordResetPage {
  private readonly identity = inject(IdentityFacade);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  protected readonly mode = this.route.snapshot.data['mode'] as PasswordResetMode;
  protected readonly completed = signal(false);
  protected readonly linkRejected = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly token = computed(() => this.queryParams().get('token'));
  protected readonly hasValidToken = computed(() => validPasswordResetToken(this.token()));
  protected readonly requestForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
  });
  protected readonly completeForm = this.formBuilder.nonNullable.group(
    {
      password: ['', PASSWORD_VALIDATORS],
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
    const email = this.requestForm.getRawValue().email.trim().toLowerCase();
    this.identity
      .requestPasswordReset(email)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => this.completed.set(true),
        error: (error: ApiError) => this.errorMessage.set(error.message),
      });
  }

  protected submitComplete(): void {
    const token = this.token();
    if (!validPasswordResetToken(token)) {
      this.linkRejected.set(true);
      return;
    }
    if (this.completeForm.invalid || this.submitting()) {
      this.completeForm.markAllAsTouched();
      return;
    }

    this.beginRequest();
    this.identity
      .completePasswordReset(token, this.completeForm.getRawValue().password)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => this.completed.set(true),
        error: (error: ApiError) => {
          if (error.code === 'INVALID_PASSWORD_RESET_TOKEN') this.linkRejected.set(true);
          else this.errorMessage.set(error.message);
        },
      });
  }

  private beginRequest(): void {
    this.submitting.set(true);
    this.errorMessage.set(null);
  }
}
