import { Injectable, signal } from '@angular/core';
import {
  DesktopDiagnostic,
  DesktopDisplayPayload,
  DesktopPeripheralConfig,
  DesktopPeripheralContext,
  DesktopPeripheralResult,
  DesktopReceiptPayload,
} from './desktop-peripheral.models';
import { DesktopPeripheralPort } from './desktop-peripheral.port';

interface DesktopBridge {
  readonly version: 1;
  getPeripheralConfig(context: DesktopPeripheralContext): Promise<DesktopPeripheralResult>;
  savePeripheralConfig(
    context: DesktopPeripheralContext,
    config: DesktopPeripheralConfig,
  ): Promise<DesktopPeripheralResult>;
  listPrinters(context: DesktopPeripheralContext): Promise<DesktopPeripheralResult>;
  diagnose(
    context: DesktopPeripheralContext,
    capability: DesktopDiagnostic,
    sample?: string,
  ): Promise<DesktopPeripheralResult>;
  printReceipt(
    context: DesktopPeripheralContext,
    operationId: string,
    receipt: DesktopReceiptPayload,
  ): Promise<DesktopPeripheralResult>;
  openDrawer(
    context: DesktopPeripheralContext,
    operationId: string,
    trigger: 'MANUAL' | 'CASH_SALE_COMPLETED',
  ): Promise<DesktopPeripheralResult>;
  updateDisplay(
    context: DesktopPeripheralContext,
    display: DesktopDisplayPayload,
  ): Promise<DesktopPeripheralResult>;
  onScan(handler: (code: string) => void): () => void;
}

@Injectable({ providedIn: 'root' })
export class WebDesktopPeripheralAdapter extends DesktopPeripheralPort {
  private readonly bridge = this.resolveBridge();
  override readonly available = signal(this.bridge?.version === 1).asReadonly();

  override getConfig(context: DesktopPeripheralContext) {
    return this.requireBridge().getPeripheralConfig(context);
  }

  override saveConfig(context: DesktopPeripheralContext, config: DesktopPeripheralConfig) {
    return this.requireBridge().savePeripheralConfig(context, config);
  }

  override listPrinters(context: DesktopPeripheralContext) {
    return this.requireBridge().listPrinters(context);
  }

  override diagnose(
    context: DesktopPeripheralContext,
    capability: DesktopDiagnostic,
    sample?: string,
  ) {
    return this.requireBridge().diagnose(context, capability, sample);
  }

  override printReceipt(
    context: DesktopPeripheralContext,
    operationId: string,
    receipt: DesktopReceiptPayload,
  ) {
    return this.requireBridge().printReceipt(context, operationId, receipt);
  }

  override openDrawer(
    context: DesktopPeripheralContext,
    operationId: string,
    trigger: 'MANUAL' | 'CASH_SALE_COMPLETED',
  ) {
    return this.requireBridge().openDrawer(context, operationId, trigger);
  }

  override updateDisplay(context: DesktopPeripheralContext, display: DesktopDisplayPayload) {
    return this.requireBridge().updateDisplay(context, display);
  }

  override onScan(handler: (code: string) => void): () => void {
    return this.bridge?.onScan(handler) ?? (() => undefined);
  }

  override notifySessionClosed(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('uinventario:session-closed'));
    }
  }

  private requireBridge(): DesktopBridge {
    if (!this.bridge) throw new Error('DESKTOP_BRIDGE_UNAVAILABLE');
    return this.bridge;
  }

  private resolveBridge(): DesktopBridge | undefined {
    if (typeof window === 'undefined') return undefined;
    return (window as typeof window & { uinventarioDesktop?: DesktopBridge }).uinventarioDesktop;
  }
}
