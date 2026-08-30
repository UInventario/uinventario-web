import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ApiError } from '../../../../core/api/api-error';
import { SessionManager } from '../../../../core/session/session-manager';
import { SessionNavigation } from '../../../../core/session/session-navigation';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, InputTextModule, ReactiveFormsModule, RouterLink],
  selector: 'ui-login-page',
  styleUrl: '../auth-page.scss',
  templateUrl: './login-page.html',
})
export class LoginPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly navigation = inject(SessionNavigation);
  private readonly route = inject(ActivatedRoute);
  private readonly sessions = inject(SessionManager);

  protected readonly errorMessage = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.maxLength(128)]],
  });

  protected submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    const { email, password } = this.form.getRawValue();
    this.sessions
      .login(email, password)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (session) =>
          this.navigation.openAuthorizedWorkspace(
            session,
            this.route.snapshot.queryParamMap.get('returnUrl'),
          ),
        error: (error: ApiError) => this.errorMessage.set(this.messageFor(error)),
      });
  }

  private messageFor(error: ApiError): string {
    if (['network', 'timeout', 'server'].includes(error.kind)) return error.message;
    return 'El correo o la contraseña no son válidos.';
  }
}
