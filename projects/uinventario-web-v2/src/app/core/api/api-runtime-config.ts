import { inject, Injectable, InjectionToken } from '@angular/core';

export interface ApiRuntimeConfiguration {
  readonly apiBaseUrl: string;
  readonly environment: 'local' | 'dev' | 'prod';
}

@Injectable({ providedIn: 'root' })
export class ApiRuntimeConfig {
  private configuration?: ApiRuntimeConfiguration;

  get apiBaseUrl(): string {
    if (!this.configuration) throw new Error('La configuración API todavía no está disponible.');
    return this.configuration.apiBaseUrl;
  }

  get environment(): ApiRuntimeConfiguration['environment'] {
    if (!this.configuration) throw new Error('La configuración API todavía no está disponible.');
    return this.configuration.environment;
  }

  async load(): Promise<void> {
    const response = await fetch('/config.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('No fue posible cargar la configuración de UInventario.');

    const candidate = (await response.json()) as Partial<ApiRuntimeConfiguration>;
    this.configuration = validateRuntimeConfiguration(candidate);
  }
}

export const API_BASE_URL = new InjectionToken<string>('UInventario API base URL', {
  providedIn: 'root',
  factory: () => inject(ApiRuntimeConfig).apiBaseUrl,
});

export function validateRuntimeConfiguration(
  candidate: Partial<ApiRuntimeConfiguration>,
): ApiRuntimeConfiguration {
  if (!['local', 'dev', 'prod'].includes(candidate.environment ?? '')) {
    throw new Error('La configuración requiere un environment válido.');
  }

  const apiBaseUrl = candidate.apiBaseUrl?.trim().replace(/\/$/, '');
  if (!apiBaseUrl || apiBaseUrl.startsWith('//')) {
    throw new Error('La configuración requiere un apiBaseUrl seguro.');
  }
  if (apiBaseUrl.startsWith('/')) {
    return { apiBaseUrl, environment: candidate.environment! };
  }

  let parsed: URL;
  try {
    parsed = new URL(apiBaseUrl);
  } catch {
    throw new Error('apiBaseUrl debe ser una URL HTTP(S) válida.');
  }
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    (candidate.environment !== 'local' && parsed.protocol !== 'https:')
  ) {
    throw new Error('apiBaseUrl no es segura para el ambiente configurado.');
  }

  return { apiBaseUrl, environment: candidate.environment! };
}
