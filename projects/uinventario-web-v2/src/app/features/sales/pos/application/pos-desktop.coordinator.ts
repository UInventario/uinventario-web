import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthorizationService } from '../../../../core/authorization/authorization.service';
import {
  DesktopPeripheralContext,
  PosPeripheralProfile,
} from '../../../../core/desktop/desktop-peripheral.models';
import { DesktopPeripheralPort } from '../../../../core/desktop/desktop-peripheral.port';
import { PosPeripheralApi } from '../../../../core/desktop/pos-peripheral-api';
import { SessionState } from '../../../../core/session/session-state';
import { PosCartQuote, PosSale } from '../domain/pos.models';

@Injectable()
export class PosDesktopCoordinator {
  private readonly authorization = inject(AuthorizationService);
  private readonly bridge = inject(DesktopPeripheralPort);
  private readonly peripherals = inject(PosPeripheralApi);
  private readonly sessions = inject(SessionState);
  private readonly destroyRef = inject(DestroyRef);

  readonly available = this.bridge.available;
  readonly profile = signal<PosPeripheralProfile | null>(null);
  readonly notice = signal<string | null>(null);
  readonly canConfigure = computed(() => this.authorization.has('TENANT_MANAGE'));
  readonly canPrint = computed(() => this.authorization.has('SALE_REPRINT'));
  readonly canOpenDrawer = computed(() => this.authorization.has('CASH_DRAWER_OPEN'));
  readonly context = computed<DesktopPeripheralContext | null>(() => {
    const session = this.sessions.session();
    const cashRegister = session?.context.cashRegister;
    const profile = this.profile();
    if (!session || !cashRegister || !profile) return null;
    return {
      tenantId: session.tenant.id,
      cashRegisterId: cashRegister.id,
      deviceId: profile.deviceId,
    };
  });

  initialize(onScan: (code: string) => void): void {
    const removeScanner = this.bridge.onScan((rawCode) => {
      const code = rawCode.trim();
      if (code) onScan(code);
    });
    this.destroyRef.onDestroy(removeScanner);
    this.loadProfile();
  }

  dismissNotice(): void {
    this.notice.set(null);
  }

  async updateCustomerDisplay(quote: PosCartQuote | null): Promise<void> {
    const context = this.context();
    if (!context) return;
    try {
      const result = await this.bridge.updateDisplay(context, {
        currency: quote?.currency ?? 'MXN',
        total: quote?.totals.payable ?? quote?.totals.total ?? '0.00',
        message: quote ? `${quote.lines.length} producto(s)` : 'Bienvenido',
        lines:
          quote?.lines.map((line) => ({
            name: line.product.name,
            quantity: line.quantity,
            total: line.total,
          })) ?? [],
      });
      if (result.status === 'FAILED') this.displayFailure();
    } catch {
      this.displayFailure();
    }
  }

  openDrawerAfterSale(sale: PosSale): void {
    if (!this.canOpenDrawer() || !sale.payments.some(({ method }) => method === 'CASH')) return;
    this.peripherals
      .openDrawer(
        { trigger: 'CASH_SALE_COMPLETED', saleId: sale.id },
        `web-v2-drawer-sale-${sale.id}`,
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (operation) =>
          void this.completeDrawerOperation(operation.id, operation.deviceId, operation.status),
        error: () => this.drawerFailure(),
      });
  }

  private loadProfile(): void {
    if (!this.available() || (!this.canPrint() && !this.canOpenDrawer())) return;
    this.peripherals
      .profile()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile) => this.profile.set(profile),
        error: () => this.notice.set('Desktop está conectado, pero falta el perfil de esta caja.'),
      });
  }

  private async completeDrawerOperation(
    operationId: string,
    deviceId: string,
    status: 'COMPLETED' | 'FAILED',
  ): Promise<void> {
    if (status === 'FAILED') {
      this.drawerFailure();
      return;
    }
    if (!this.available()) {
      this.notice.set(`Apertura enviada al dispositivo ${deviceId}.`);
      return;
    }
    const context = this.contextForDevice(deviceId);
    if (!context) return;
    try {
      const result = await this.bridge.openDrawer(context, operationId, 'CASH_SALE_COMPLETED');
      this.notice.set(
        result.status === 'COMPLETED'
          ? result.replayed
            ? 'La apertura del cajón ya había sido procesada; no se repitió.'
            : 'Venta registrada y cajón abierto.'
          : 'La venta quedó registrada, pero el cajón no respondió. Ábrelo manualmente.',
      );
    } catch {
      this.notice.set(
        'La venta quedó registrada, pero el bridge Desktop no respondió. Abre el cajón manualmente.',
      );
    }
  }

  private contextForDevice(deviceId: string): DesktopPeripheralContext | null {
    const session = this.sessions.session();
    const cashRegister = session?.context.cashRegister;
    if (!session || !cashRegister) return null;
    return { tenantId: session.tenant.id, cashRegisterId: cashRegister.id, deviceId };
  }

  private drawerFailure(): void {
    this.notice.set('La venta quedó registrada, pero el cajón no respondió. Ábrelo manualmente.');
  }

  private displayFailure(): void {
    this.notice.set('La pantalla cliente no respondió; puedes continuar la venta.');
  }
}
