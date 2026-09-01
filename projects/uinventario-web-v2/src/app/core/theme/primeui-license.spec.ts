import { describe, expect, it } from 'vitest';
import { configuredPrimeUiLicense } from './primeui-license';

describe('configuredPrimeUiLicense', () => {
  it('uses one normalized license supplied by the build', () => {
    expect(configuredPrimeUiLicense('  payload.signature  ')).toBe('payload.signature');
  });

  it('keeps local and test builds unconfigured without inventing a key', () => {
    expect(configuredPrimeUiLicense()).toBeUndefined();
    expect(configuredPrimeUiLicense('   ')).toBeUndefined();
    expect(configuredPrimeUiLicense({})).toBeUndefined();
  });
});
