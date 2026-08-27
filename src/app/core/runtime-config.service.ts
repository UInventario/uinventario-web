import { Injectable, signal } from '@angular/core';

interface RuntimeConfig {
  apiBaseUrl: string;
}

@Injectable({ providedIn: 'root' })
export class RuntimeConfigService {
  readonly apiBaseUrl = signal('');

  async load(): Promise<void> {
    const response = await fetch('/config.json', { cache: 'no-store' });

    if (!response.ok) {
      throw new Error('No fue posible cargar la configuración de UInventario.');
    }

    const config = (await response.json()) as Partial<RuntimeConfig>;
    const apiBaseUrl = config.apiBaseUrl?.trim().replace(/\/$/, '');

    if (!apiBaseUrl) {
      throw new Error('La configuración requiere apiBaseUrl.');
    }

    this.apiBaseUrl.set(apiBaseUrl);
  }
}
