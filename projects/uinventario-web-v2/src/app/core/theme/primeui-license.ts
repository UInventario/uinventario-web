declare const PRIMEUI_LICENSE: unknown;

export function configuredPrimeUiLicense(
  candidate: unknown = typeof PRIMEUI_LICENSE === 'undefined' ? undefined : PRIMEUI_LICENSE,
): string | undefined {
  if (typeof candidate !== 'string') return undefined;
  const normalized = candidate.trim();
  return normalized || undefined;
}
