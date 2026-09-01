import { Signal } from '@angular/core';
import {
  DesktopDiagnostic,
  DesktopDisplayPayload,
  DesktopPeripheralConfig,
  DesktopPeripheralContext,
  DesktopPeripheralResult,
  DesktopReceiptPayload,
} from './desktop-peripheral.models';

export abstract class DesktopPeripheralPort {
  abstract readonly available: Signal<boolean>;
  abstract getConfig(context: DesktopPeripheralContext): Promise<DesktopPeripheralResult>;
  abstract saveConfig(
    context: DesktopPeripheralContext,
    config: DesktopPeripheralConfig,
  ): Promise<DesktopPeripheralResult>;
  abstract listPrinters(context: DesktopPeripheralContext): Promise<DesktopPeripheralResult>;
  abstract diagnose(
    context: DesktopPeripheralContext,
    capability: DesktopDiagnostic,
    sample?: string,
  ): Promise<DesktopPeripheralResult>;
  abstract printReceipt(
    context: DesktopPeripheralContext,
    operationId: string,
    receipt: DesktopReceiptPayload,
  ): Promise<DesktopPeripheralResult>;
  abstract openDrawer(
    context: DesktopPeripheralContext,
    operationId: string,
    trigger: 'MANUAL' | 'CASH_SALE_COMPLETED',
  ): Promise<DesktopPeripheralResult>;
  abstract updateDisplay(
    context: DesktopPeripheralContext,
    display: DesktopDisplayPayload,
  ): Promise<DesktopPeripheralResult>;
  abstract onScan(handler: (code: string) => void): () => void;
  abstract notifySessionClosed(): void;
}
