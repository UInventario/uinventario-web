import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SessionApiService } from '../auth/session-api.service';
import { OfflineBootstrapApiService, OfflineBootstrapData } from './offline-bootstrap-api.service';
import {
  OfflineFreshnessState,
  OfflineOutboxCommand,
  OfflineStoreService,
} from './offline-store.service';
import { OfflineOutboxService } from './offline-outbox.service';

@Component({
  selector: 'app-offline-bootstrap-panel',
  templateUrl: './offline-bootstrap-panel.component.html',
  styleUrl: './offline-bootstrap-panel.component.scss',
})
export class OfflineBootstrapPanelComponent implements OnInit, OnDestroy {
  private readonly api = inject(OfflineBootstrapApiService);
  private readonly store = inject(OfflineStoreService);
  private readonly outbox = inject(OfflineOutboxService);
  private readonly sessions = inject(SessionApiService);

  protected readonly preparing = signal(false);
  protected readonly syncing = signal(false);
  protected readonly sendingCommands = signal(false);
  protected readonly pendingCommands = signal(0);
  protected readonly rejectedCommands = signal(0);
  protected readonly commands = signal<OfflineOutboxCommand[]>([]);
  protected readonly onlineState = signal(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  protected readonly freshness = signal<OfflineFreshnessState | null>(null);
  protected readonly downloaded = signal(0);
  protected readonly result = signal<{
    entities: number;
    generatedAt: string;
    restored: boolean;
  } | null>(null);
  protected readonly error = signal<string | null>(null);
  private freshnessTimer: ReturnType<typeof setInterval> | undefined;

  ngOnInit(): void {
    void this.restore();
    this.freshnessTimer = setInterval(() => void this.refreshCurrentFreshness(), 60_000);
  }

  ngOnDestroy(): void {
    if (this.freshnessTimer !== undefined) clearInterval(this.freshnessTimer);
  }

  @HostListener('window:online')
  protected online(): void {
    this.onlineState.set(true);
    if (!this.sessions.session()) return;
    void this.recoverOnline();
  }

  @HostListener('window:offline')
  protected offline(): void {
    this.onlineState.set(false);
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
      await this.refreshOutbox(lastPage.scope);
      await this.refreshFreshness(lastPage.scope);
      this.result.set({
        entities: this.downloaded(),
        generatedAt: lastPage.generatedAt,
        restored: false,
      });
    } catch (error) {
      this.invalidateRevokedAccess(error);
      this.error.set(this.message(error));
    } finally {
      this.preparing.set(false);
    }
  }

  protected async sendPending(): Promise<void> {
    if (this.sendingCommands()) return;
    this.sendingCommands.set(true);
    this.error.set(null);
    try {
      const scope = await this.currentScope();
      await this.outbox.flush(scope);
      await this.refreshOutbox(scope);
    } catch (error) {
      this.error.set(this.message(error));
      try {
        await this.refreshOutbox(await this.currentScope());
      } catch {
        // The session may have ended while the request was in flight.
      }
    } finally {
      this.sendingCommands.set(false);
    }
  }

  protected async sync(): Promise<void> {
    if (this.syncing() || this.preparing()) return;
    this.syncing.set(true);
    this.error.set(null);
    try {
      const scope = await this.currentScope();
      const deviceId = scope.deviceId;
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
        await this.store.applyChanges(scope, data.changes, data.nextCursor, {
          generatedAt: data.generatedAt,
          sessionExpiresAt: data.sessionExpiresAt,
          freshnessPolicy: data.freshnessPolicy,
          roles: data.identity.user.roles,
          permissions: data.identity.user.permissions,
        });
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
      await this.refreshFreshness(scope);
    } catch (error) {
      if (error instanceof HttpErrorResponse && [400, 410].includes(error.status)) {
        await this.prepare();
      } else {
        this.invalidateRevokedAccess(error);
        this.error.set(this.message(error));
      }
    } finally {
      this.syncing.set(false);
    }
  }

  protected async retryCommand(commandId: string): Promise<void> {
    const scope = await this.currentScope();
    await this.store.retryNow(scope, commandId);
    await this.sendPending();
  }

  protected async rejectCommand(commandId: string): Promise<void> {
    const scope = await this.currentScope();
    await this.store.rejectPending(scope, commandId);
    await this.refreshOutbox(scope);
  }

  protected commandError(command: OfflineOutboxCommand): string {
    if (command.status === 'PENDING') return 'Pendiente de envío';
    if (command.status === 'SENT') return 'Confirmación pendiente';
    const error = command.lastError as {
      details?: { message?: string; code?: string };
      message?: string;
    } | null;
    return (
      error?.details?.message ?? error?.details?.code ?? error?.message ?? 'Revisión requerida'
    );
  }

  private async restore(): Promise<void> {
    try {
      if (!this.sessions.session()) return;
      const scope = await this.currentScope();
      const summary = await this.store.summary(scope);
      if (summary) {
        this.downloaded.set(summary.entities);
        this.result.set({
          entities: summary.entities,
          generatedAt: summary.generatedAt,
          restored: true,
        });
      }
      await this.refreshOutbox(scope);
      await this.refreshFreshness(scope);
    } catch (error) {
      this.error.set(this.message(error));
    }
  }

  private async currentScope() {
    const session = this.sessions.session();
    if (!session) throw new Error('La sesión ya no está disponible.');
    return {
      tenantId: session.tenant.id,
      userId: session.user.id,
      deviceId: await this.store.deviceId(),
      branchId: session.context.branch?.id ?? null,
      cashRegisterId: session.context.cashRegister?.id ?? null,
    };
  }

  private async refreshOutbox(scope: Awaited<ReturnType<typeof this.currentScope>>): Promise<void> {
    const commands = await this.store.outbox(scope);
    this.commands.set(commands.filter(({ status }) => status !== 'CONFIRMED').slice(-10));
    this.pendingCommands.set(
      commands.filter(
        ({ status, retryable }) =>
          status === 'PENDING' || status === 'SENT' || (status === 'ERROR' && retryable),
      ).length,
    );
    this.rejectedCommands.set(
      commands.filter(({ status, retryable }) => status === 'ERROR' && !retryable).length,
    );
  }

  protected sensitiveBlocked(state: OfflineFreshnessState): boolean {
    return Object.values(state.allowedActions).some((allowed) => !allowed);
  }

  private async refreshFreshness(
    scope: Awaited<ReturnType<typeof this.currentScope>>,
  ): Promise<void> {
    this.freshness.set(await this.store.freshness(scope));
  }

  private async recoverOnline(): Promise<void> {
    try {
      await firstValueFrom(this.sessions.loadCurrent());
    } catch (error) {
      this.error.set(this.message(error));
      return;
    }
    await this.sendPending();
    if (this.sessions.session()) await this.sync();
  }

  private async refreshCurrentFreshness(): Promise<void> {
    if (!this.sessions.session()) return;
    try {
      await this.refreshFreshness(await this.currentScope());
    } catch {
      // The status will refresh after the next successful bootstrap or sync.
    }
  }

  private invalidateRevokedAccess(error: unknown): void {
    if (
      error instanceof HttpErrorResponse &&
      (error.status === 401 ||
        (error.status === 403 && error.error?.code === 'OFFLINE_DEVICE_REVOKED'))
    ) {
      this.sessions.invalidate();
    }
  }

  private message(error: unknown): string {
    if (error instanceof HttpErrorResponse && typeof error.error?.message === 'string') {
      return error.error.message;
    }
    return error instanceof Error ? error.message : 'No fue posible descargar el bootstrap.';
  }
}
