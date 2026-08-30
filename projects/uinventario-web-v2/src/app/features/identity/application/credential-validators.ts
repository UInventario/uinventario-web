import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

export const PASSWORD_VALIDATORS: ValidatorFn[] = [
  Validators.required,
  Validators.minLength(12),
  Validators.maxLength(128),
  Validators.pattern(/[a-z]/),
  Validators.pattern(/[A-Z]/),
  Validators.pattern(/[0-9]/),
  Validators.pattern(/[^A-Za-z0-9]/),
];

export function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value as string | undefined;
  const confirmation = control.get('passwordConfirmation')?.value as string | undefined;
  return password === confirmation ? null : { passwordsMismatch: true };
}

export function validPasswordResetToken(token: string | null): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);
}
