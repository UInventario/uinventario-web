import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SessionApiService } from '../auth/session-api.service';
import { OfflineBootstrapApiService, OfflineBootstrapData } from './offline-bootstrap-api.service';
import { OfflineStoreService } from './offline-store.service';

@Component({
  selector: 'app-offline-bootstrap-panel',
  templateUrl: './offline-bootstrap-panel.component.html',
  styleUrl: './offline-bootstrap-panel.component.scss',
})
export class OfflineBootstrapPanelComponent implements OnInit {
  private readonly api = inject(OfflineBootstrapApiService);
  private readonly store = inject(OfflineStoreService);
  private readonly sessions = inject(SessionApiService);

  protected readonly preparing = signal(false);
  protected readonly syncing = signal(false);
  protected readonly downloaded = signal(0);
  protected readonly result = signal<{
    entities: number;
    generatedAt: string;
    restored: boolean;
  } | null>(null);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    void this.restore();
  }

  protected async prepare(): Promise<void> {
    if (this.preparing()) return;
    this.preparing.set(true);
    this.downloaded.set(0);
    this.result.set(null);
    this.error.set(null);
    try {
      const deviceId = await this.store.deviceId();
      let cursor: string | undefined;
      let expectedScope: string | undefined;
      let initialSyncCursor: string | undefined;
      let lastPage: OfflineBootstrapData | undefined;
      const entities: OfflineBootstrapData['page']['entities'] = [];
      do {
        const { data } = await firstValueFrom(this.api.page(deviceId, cursor));
        const scope = JSON.stringify(data.scope);
        if (
          expectedScope &&
          (scope !== expectedScope || data.page.initialSyncCursor !== initialSyncCursor)
        ) {
          throw new Error('El alcance de la sesión cambió durante la descarga. Inicia de nuevo.');
        }
        expectedScope ??= scope;
        initialSyncCursor ??= data.page.initialSyncCursor;
        entities.push(...data.page.entities);
        this.downloaded.update((count) => count + data.page.entities.length);
        cursor = data.page.nextCursor ?? undefined;
        lastPage = data;
      } while (cursor);
      if (!lastPage) throw new Error('El servidor no entregó un bootstrap válido.');
      await this.store.replaceBootstrap(lastPage, entities);
      this.result.set({
        entities: this.downloaded(),
        generatedAt: lastPage.generatedAt,
        restored: false,
      });
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.preparing.set(false);
    }
  }

  protected async sync(): Promise<void> {
    if (this.syncing() || this.preparing()) return;
    this.syncing.set(true);
    this.error.set(null);
    try {
      const session = this.sessions.session();
      if (!session) throw new Error('La sesión ya no está disponible.');
      const deviceId = await this.store.deviceId();
      const scope = {
        tenantId: session.tenant.id,
        userId: session.user.id,
        deviceId,
        branchId: session.context.branch?.id ?? null,
        cashRegisterId: session.context.cashRegister?.id ?? null,
      };
      const summary = await this.store.summary(scope);
      if (!summary) {
        await this.prepare();
        return;
      }
      let cursor = summary.cursor;
      let hasMore: boolean;
      do {
        const { data } = await firstValueFrom(this.api.changes(deviceId, cursor));
        if (JSON.stringify(data.scope) !== JSON.stringify(scope)) {
          throw new Error('El alcance cambió durante la sincronización.');
        }
        await this.store.applyChanges(scope, data.changes, data.nextCursor);
        cursor = data.nextCursor;
        hasMore = data.hasMore;
      } while (hasMore);
      const updated = await this.store.summary(scope);
      this.downloaded.set(updated?.entities ?? 0);
      this.result.set({
        entities: updated?.entities ?? 0,
        generatedAt: updated?.generatedAt ?? new Date().toISOString(),
        restored: false,
      });
      this.error.set(null);
    } catch (error) {
      if (error instanceof HttpErrorResponse && [400, 410].includes(error.status)) {
        await this.prepare();
      } else {
        this.error.set(this.message(error));
      }
    } finally {
      this.syncing.set(false);
    }
  }

  private async restore(): Promise<void> {
    try {
      const session = this.sessions.session();
      if (!session) return;
      const deviceId = await this.store.deviceId();
      const summary = await this.store.summary({
        tenantId: session.tenant.id,
        userId: session.user.id,
        deviceId,
        branchId: session.context.branch?.id ?? null,
        cashRegisterId: session.context.cashRegister?.id ?? null,
      });
      if (summary) {
        this.downloaded.set(summary.entities);
        this.result.set({
          entities: summary.entities,
          generatedAt: summary.generatedAt,
          restored: true,
        });
      }
    } catch (error) {
      this.error.set(this.message(error));
    }
  }

  private message(error: unknown): string {
    if (error instanceof HttpErrorResponse && typeof error.error?.message === 'string') {
      return error.error.message;
    }
    return error instanceof Error ? error.message : 'No fue posible descargar el bootstrap.';
  }
}
