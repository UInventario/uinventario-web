import { Injectable, signal } from '@angular/core';

export interface DesktopPeripheralContext {
  tenantId: string;
  cashRegisterId: string;
  deviceId: string;
}

export interface DesktopPeripheralConfig {
  scannerAdapter: 'HID_KEYBOARD';
  printerAdapter: 'SIMULATOR' | 'SYSTEM';
  printerName: string | null;
  drawerAdapter: 'SIMULATOR';
  displayAdapter: 'SIMULATOR' | 'WINDOW';
  simulateDisconnected: boolean;
}

export interface DesktopPeripheralResult {
  status: 'COMPLETED' | 'FAILED';
  adapter?: string;
  replayed?: boolean;
  errorCode?: string;
  config?: DesktopPeripheralConfig;
  printers?: Array<{ name: string; displayName: string; status: number; isDefault: boolean }>;
}

interface DesktopPeripheralBridge {
  version: 1;
  getPeripheralConfig(context: DesktopPeripheralContext): Promise<DesktopPeripheralResult>;
  savePeripheralConfig(
    context: DesktopPeripheralContext,
    config: DesktopPeripheralConfig,
  ): Promise<DesktopPeripheralResult>;
  listPrinters(context: DesktopPeripheralContext): Promise<DesktopPeripheralResult>;
  diagnose(
    context: DesktopPeripheralContext,
    capability: 'SCANNER' | 'PRINTER' | 'DRAWER' | 'DISPLAY',
    sample?: string,
  ): Promise<DesktopPeripheralResult>;
  printReceipt(
    context: DesktopPeripheralContext,
    operationId: string,
    receipt: {
      receiptNumber: string;
      merchantName: string;
      currency: string;
      total: string;
      lines: Array<{ name: string; quantity: string; total: string }>;
    },
  ): Promise<DesktopPeripheralResult>;
  openDrawer(
    context: DesktopPeripheralContext,
    operationId: string,
    trigger: 'MANUAL' | 'CASH_SALE_COMPLETED',
  ): Promise<DesktopPeripheralResult>;
  updateDisplay(
    context: DesktopPeripheralContext,
    display: {
      currency: string;
      total: string;
      message: string;
      lines: Array<{ name: string; quantity: string; total: string }>;
    },
  ): Promise<DesktopPeripheralResult>;
  onScan(handler: (code: string) => void): () => void;
}

@Injectable({ providedIn: 'root' })
export class DesktopPeripheralService {
  private readonly bridge = this.resolveBridge();
  readonly available = signal(this.bridge?.version === 1);

  getConfig(context: DesktopPeripheralContext) {
    return this.requireBridge().getPeripheralConfig(context);
  }

  saveConfig(context: DesktopPeripheralContext, config: DesktopPeripheralConfig) {
    return this.requireBridge().savePeripheralConfig(context, config);
  }

  listPrinters(context: DesktopPeripheralContext) {
    return this.requireBridge().listPrinters(context);
  }

  diagnose(
    context: DesktopPeripheralContext,
    capability: 'SCANNER' | 'PRINTER' | 'DRAWER' | 'DISPLAY',
    sample?: string,
  ) {
    return this.requireBridge().diagnose(context, capability, sample);
  }

  printReceipt(
    context: DesktopPeripheralContext,
    operationId: string,
    receipt: Parameters<DesktopPeripheralBridge['printReceipt']>[2],
  ) {
    return this.requireBridge().printReceipt(context, operationId, receipt);
  }

  openDrawer(
    context: DesktopPeripheralContext,
    operationId: string,
    trigger: 'MANUAL' | 'CASH_SALE_COMPLETED',
  ) {
    return this.requireBridge().openDrawer(context, operationId, trigger);
  }

  updateDisplay(
    context: DesktopPeripheralContext,
    display: Parameters<DesktopPeripheralBridge['updateDisplay']>[1],
  ) {
    return this.requireBridge().updateDisplay(context, display);
  }

  onScan(handler: (code: string) => void): () => void {
    return this.bridge?.onScan(handler) ?? (() => undefined);
  }

  private requireBridge(): DesktopPeripheralBridge {
    if (!this.bridge) throw new Error('DESKTOP_BRIDGE_UNAVAILABLE');
    return this.bridge;
  }

  private resolveBridge(): DesktopPeripheralBridge | undefined {
    if (typeof window === 'undefined') return undefined;
    return (window as typeof window & { uinventarioDesktop?: DesktopPeripheralBridge })
      .uinventarioDesktop;
  }
}
