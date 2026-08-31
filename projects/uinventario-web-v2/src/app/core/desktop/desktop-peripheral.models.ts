export interface DesktopPeripheralContext {
  readonly tenantId: string;
  readonly cashRegisterId: string;
  readonly deviceId: string;
}

export interface DesktopPeripheralConfig {
  readonly scannerAdapter: 'HID_KEYBOARD';
  readonly printerAdapter: 'SIMULATOR' | 'SYSTEM';
  readonly printerName: string | null;
  readonly drawerAdapter: 'SIMULATOR';
  readonly displayAdapter: 'SIMULATOR' | 'WINDOW';
  readonly simulateDisconnected: boolean;
}

export interface DesktopPrinter {
  readonly name: string;
  readonly displayName: string;
  readonly status: number;
  readonly isDefault: boolean;
}

export interface DesktopReceiptPayload {
  readonly receiptNumber: string;
  readonly merchantName: string;
  readonly currency: string;
  readonly total: string;
  readonly lines: readonly {
    readonly name: string;
    readonly quantity: string;
    readonly total: string;
  }[];
}

export interface DesktopDisplayPayload {
  readonly currency: string;
  readonly total: string;
  readonly message: string;
  readonly lines: readonly {
    readonly name: string;
    readonly quantity: string;
    readonly total: string;
  }[];
}

export interface DesktopPeripheralResult {
  readonly status: 'COMPLETED' | 'FAILED';
  readonly adapter?: string;
  readonly replayed?: boolean;
  readonly errorCode?: string;
  readonly config?: DesktopPeripheralConfig;
  readonly printers?: readonly DesktopPrinter[];
}

export type DesktopDiagnostic = 'SCANNER' | 'PRINTER' | 'DRAWER' | 'DISPLAY';

export interface PosPeripheralProfile {
  readonly id: string;
  readonly cashRegister: { readonly id: string; readonly name: string; readonly code: string };
  readonly deviceId: string;
  readonly label: string;
  readonly adapter: 'SIMULATOR';
  readonly printerEnabled: boolean;
  readonly drawerEnabled: boolean;
  readonly autoOpenCashSale: boolean;
  readonly updatedAt: string;
}

export interface PosPeripheralOperation {
  readonly id: string;
  readonly action: 'PRINT_RECEIPT' | 'OPEN_DRAWER';
  readonly trigger: 'MANUAL' | 'CASH_SALE_COMPLETED';
  readonly status: 'COMPLETED' | 'FAILED';
  readonly attemptCount: number;
  readonly errorCode: string | null;
  readonly saleId: string | null;
  readonly deviceId: string;
  readonly createdAt: string;
  readonly completedAt: string | null;
}

export interface PosReceiptForPeripheral {
  readonly saleId: string;
  readonly receiptNumber: string;
  readonly currency: string;
  readonly merchant: { readonly name: string };
  readonly totals: { readonly total: string };
  readonly lines: readonly {
    readonly productName: string;
    readonly quantity: string;
    readonly total: string;
  }[];
}
