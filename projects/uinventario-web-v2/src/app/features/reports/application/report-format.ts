export function reportMoney(value: string, currency: string): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(Number(value));
}

export function reportDate(value: string | null, timezone = 'UTC'): string {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone,
    }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(new Date(value));
  }
}
