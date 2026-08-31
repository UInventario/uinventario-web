import { InventoryLocation } from '../../domain/inventory.models';

export type LotExpirationStatus = 'NO_EXPIRATION' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'EXHAUSTED';

export interface InventoryLot {
  readonly id: string;
  readonly code: string;
  readonly product: { readonly id: string; readonly name: string; readonly sku: string };
  readonly quantity: string;
  readonly unitCost: string;
  readonly currency: string;
  readonly inventoryValue: string;
  readonly manufacturedOn: string | null;
  readonly expiresOn: string | null;
  readonly expirationStatus: LotExpirationStatus;
  readonly daysUntilExpiration: number | null;
  readonly createdAt: string;
  readonly origins: readonly {
    readonly purchaseReceiptLineId: string;
    readonly quantity: string;
    readonly unitCost: string;
    readonly currency: string;
    readonly receipt: { readonly id: string; readonly documentReference: string };
    readonly purchaseOrder: { readonly id: string; readonly folio: string };
  }[];
  readonly balances: readonly {
    readonly location: InventoryLocation;
    readonly quantity: string;
  }[];
}

export interface InventoryLots {
  readonly items: readonly InventoryLot[];
  readonly tracked: boolean;
  readonly totalQuantity: string;
  readonly lotQuantity: string;
  readonly reconciled: boolean;
  readonly currency: string | null;
  readonly inventoryValue: string;
}

export interface LotExpirationAlert {
  readonly id: string;
  readonly status: 'EXPIRING' | 'EXPIRED';
  readonly product: { readonly id: string; readonly name: string; readonly sku: string };
  readonly lot: { readonly id: string; readonly code: string; readonly expiresOn: string };
  readonly location: InventoryLocation;
  readonly quantity: string;
  readonly daysUntilExpiration: number;
}

export interface LotExpirationAlerts {
  readonly items: readonly LotExpirationAlert[];
  readonly businessDate: string;
}

export type InventorySerialStatus =
  'AVAILABLE' | 'RESERVED' | 'DAMAGED' | 'IN_TRANSIT' | 'SOLD' | 'RETURNED_TO_SUPPLIER' | 'REMOVED';

export interface InventorySerial {
  readonly id: string;
  readonly serialNumber: string;
  readonly status: InventorySerialStatus;
  readonly product: { readonly id: string; readonly name: string; readonly sku: string };
  readonly currentLocation: InventoryLocation | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface InventorySerials {
  readonly items: readonly InventorySerial[];
  readonly tracked: boolean;
}

export interface InventorySerialEvent {
  readonly id: string;
  readonly movement: {
    readonly id: string;
    readonly type: string;
    readonly reference: string | null;
    readonly reason: string;
  };
  readonly fromStatus: InventorySerialStatus | null;
  readonly toStatus: InventorySerialStatus;
  readonly fromLocation: InventoryLocation | null;
  readonly toLocation: InventoryLocation | null;
  readonly responsible: { readonly id: string; readonly email: string };
  readonly createdAt: string;
}

export interface InventorySerialHistory {
  readonly serial: InventorySerial;
  readonly events: readonly InventorySerialEvent[];
}
