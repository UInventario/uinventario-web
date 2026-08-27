import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { OfflineBootstrapApiService, OfflineBootstrapData } from './offline-bootstrap-api.service';

@Component({
  selector: 'app-offline-bootstrap-panel',
  templateUrl: './offline-bootstrap-panel.component.html',
  styleUrl: './offline-bootstrap-panel.component.scss',
})
export class OfflineBootstrapPanelComponent {
  private readonly api = inject(OfflineBootstrapApiService);
  private readonly deviceId = crypto.randomUUID();

  protected readonly preparing = signal(false);
  protected readonly downloaded = signal(0);
  protected readonly result = signal<{ entities: number; generatedAt: string } | null>(null);
  protected readonly error = signal<string | null>(null);

  protected async prepare(): Promise<void> {
    if (this.preparing()) return;
    this.preparing.set(true);
    this.downloaded.set(0);
    this.result.set(null);
    this.error.set(null);
    try {
      let cursor: string | undefined;
      let expectedScope: string | undefined;
      let initialSyncCursor: string | undefined;
      let lastPage: OfflineBootstrapData | undefined;
      do {
        const { data } = await firstValueFrom(this.api.page(this.deviceId, cursor));
        const scope = JSON.stringify(data.scope);
        if (
          expectedScope &&
          (scope !== expectedScope || data.page.initialSyncCursor !== initialSyncCursor)
        ) {
          throw new Error('El alcance de la sesión cambió durante la descarga. Inicia de nuevo.');
        }
        expectedScope ??= scope;
        initialSyncCursor ??= data.page.initialSyncCursor;
        this.downloaded.update((count) => count + data.page.entities.length);
        cursor = data.page.nextCursor ?? undefined;
        lastPage = data;
      } while (cursor);
      this.result.set({
        entities: this.downloaded(),
        generatedAt: lastPage?.generatedAt ?? new Date().toISOString(),
      });
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.preparing.set(false);
    }
  }

  private message(error: unknown): string {
    if (error instanceof HttpErrorResponse && typeof error.error?.message === 'string') {
      return error.error.message;
    }
    return error instanceof Error ? error.message : 'No fue posible descargar el bootstrap.';
  }
}
