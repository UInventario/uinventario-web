import { safeReturnUrl } from './session-navigation';

describe('safeReturnUrl', () => {
  it('accepts only local protected destinations', () => {
    expect(safeReturnUrl('/ventas?turno=actual')).toBe('/ventas?turno=actual');
    expect(safeReturnUrl('https://attacker.example')).toBe('/dashboard');
    expect(safeReturnUrl('//attacker.example')).toBe('/dashboard');
    expect(safeReturnUrl('/\\attacker.example')).toBe('/dashboard');
    expect(safeReturnUrl('/login')).toBe('/dashboard');
    expect(safeReturnUrl('/recuperar?returnUrl=/ventas')).toBe('/dashboard');
  });
});
