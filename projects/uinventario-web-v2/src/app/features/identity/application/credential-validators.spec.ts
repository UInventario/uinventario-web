import { FormControl, FormGroup } from '@angular/forms';
import { passwordsMatch, validPasswordResetToken } from './credential-validators';

describe('credential validators', () => {
  it('requires matching passwords', () => {
    const group = new FormGroup({
      password: new FormControl('SecurePass!123'),
      passwordConfirmation: new FormControl('DifferentPass!123'),
    });
    expect(passwordsMatch(group)).toEqual({ passwordsMismatch: true });
    group.controls.passwordConfirmation.setValue('SecurePass!123');
    expect(passwordsMatch(group)).toBeNull();
  });

  it('accepts only the 43-character URL-safe token contract', () => {
    expect(validPasswordResetToken('a'.repeat(43))).toBe(true);
    expect(validPasswordResetToken('a'.repeat(42))).toBe(false);
    expect(validPasswordResetToken(`${'a'.repeat(42)}+`)).toBe(false);
    expect(validPasswordResetToken(null)).toBe(false);
  });
});
