import { Injectable, signal } from '@angular/core';

interface RuntimeConfig {
  environment: 'local' | 'dev' | 'prod';
  apiBaseUrl: string;
}

@Injectable({ providedIn: 'root' })
export class RuntimeConfigService {
  readonly environment = signal<RuntimeConfig['environment']>('local');
  readonly apiBaseUrl = signal('');

  async load(): Promise<void> {
    const response = await fetch('/config.json', { cache: 'no-store' });

    if (!response.ok) {
      throw new Error('No fue posible cargar la configuración de UInventario.');
    }

    const config = (await response.json()) as Partial<RuntimeConfig>;
    if (!['local', 'dev', 'prod'].includes(config.environment ?? '')) {
      throw new Error('La configuración requiere un environment válido.');
    }

    const apiBaseUrl = config.apiBaseUrl?.trim().replace(/\/$/, '');

    if (!apiBaseUrl) {
      throw new Error('La configuración requiere apiBaseUrl.');
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
      (config.environment !== 'local' && parsed.protocol !== 'https:')
    ) {
      throw new Error('apiBaseUrl no es segura para el ambiente configurado.');
    }

    this.environment.set(config.environment!);
    this.apiBaseUrl.set(apiBaseUrl);
  }
}
