import { SessionData } from '../session/session.models';

export const OFFLINE_PROTOCOL_VERSION = '1.0' as const;

export interface OfflineScope {
  readonly tenantId: string;
  readonly userId: string;
  readonly deviceId: string;
  readonly branchId: string | null;
  readonly cashRegisterId: string | null;
}

export interface OfflineEntity {
  readonly kind: string;
  readonly id: string;
  readonly tenantId: string;
  readonly version: number;
  readonly updatedAt: string;
  readonly [key: string]: unknown;
}

export interface OfflineFreshnessPolicy {
  readonly version: number;
  readonly maxClockSkewSeconds: number;
  readonly catalogTtlSeconds: number;
  readonly permissionsTtlSeconds: number;
  readonly actionTtlSeconds: Readonly<Record<OfflineCommandKind, number>>;
}

export interface OfflineBootstrap {
  readonly protocolVersion: typeof OFFLINE_PROTOCOL_VERSION;
  readonly generatedAt: string;
  readonly sessionExpiresAt: string;
  readonly freshnessPolicy: OfflineFreshnessPolicy;
  readonly scope: OfflineScope;
  readonly identity: {
    readonly tenant: { readonly id: string; readonly name: string };
    readonly user: {
      readonly id: string;
      readonly roles: readonly string[];
      readonly permissions: SessionData['user']['permissions'];
    };
  };
  readonly valuationPolicy: {
    readonly method: 'MOVING_AVERAGE' | 'FIFO' | 'SPECIFIC_LOT';
    readonly version: number;
  };
  readonly posPolicy:
    | (OfflineEntity & {
        readonly kind: 'POS_POLICY';
        readonly branchId: string;
        readonly warehouseId: string;
        readonly cashRegisterId: string;
        readonly shiftId: string;
        readonly shiftOpenedAt: string;
        readonly currency: string;
        readonly taxRate: string;
        readonly paymentMethods: readonly ['CASH'];
        readonly negativeStock: 'DENY';
      })
    | null;
  readonly page: {
    readonly initialSyncCursor: string;
    readonly nextCursor: string | null;
    readonly complete: boolean;
    readonly entities: readonly OfflineEntity[];
  };
}

export interface OfflineChanges {
  readonly generatedAt: string;
  readonly sessionExpiresAt: string;
  readonly freshnessPolicy: OfflineFreshnessPolicy;
  readonly scope: OfflineScope;
  readonly identity: {
    readonly user: {
      readonly id: string;
      readonly roles: readonly string[];
      readonly permissions: SessionData['user']['permissions'];
    };
  };
  readonly nextCursor: string;
  readonly hasMore: boolean;
  readonly changes: readonly {
    readonly changeId: string;
    readonly operation: 'UPSERT' | 'DELETE';
    readonly entity: OfflineEntity;
  }[];
}

export type OfflineCommandKind = 'CASH_SALE' | 'INVENTORY_COUNT' | 'INVENTORY_MOVEMENT';
export type OfflineCommandStatus = 'PENDING' | 'SENDING' | 'ERROR';

export interface OfflineCommand {
  readonly protocolVersion: typeof OFFLINE_PROTOCOL_VERSION;
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly scope: OfflineScope;
  readonly sequence: number;
  readonly createdAt: string;
  readonly valuationMethod: OfflineBootstrap['valuationPolicy']['method'];
  readonly valuationPolicyVersion: number;
  readonly kind: OfflineCommandKind;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly status: OfflineCommandStatus;
  readonly attempts: number;
  readonly nextRetryAt: string | null;
  readonly retryable: boolean;
  readonly error: unknown;
}

export interface OfflineRecord {
  readonly key: string;
  readonly scope: OfflineScope;
  readonly session: SessionData;
  readonly generatedAt: string;
  readonly sessionExpiresAt: string;
  readonly cursor: string;
  readonly freshnessPolicy: OfflineFreshnessPolicy;
  readonly valuationPolicy: OfflineBootstrap['valuationPolicy'];
  readonly entities: readonly OfflineEntity[];
  readonly commands: readonly OfflineCommand[];
}

export interface OfflineSessionSnapshot {
  readonly session: SessionData;
  readonly sessionExpiresAt: string;
}

export interface OfflineSummary {
  readonly prepared: boolean;
  readonly entities: number;
  readonly pending: number;
  readonly conflicts: number;
  readonly generatedAt: string | null;
  readonly catalogStale: boolean;
  readonly permissionsStale: boolean;
  readonly sessionExpired: boolean;
}

export function scopeFor(session: SessionData, deviceId: string): OfflineScope {
  return {
    tenantId: session.tenant.id,
    userId: session.user.id,
    deviceId,
    branchId: session.context.branch?.id ?? null,
    cashRegisterId: session.context.cashRegister?.id ?? null,
  };
}

export function offlineScopeKey(scope: OfflineScope): string {
  return [
    scope.tenantId,
    scope.userId,
    scope.deviceId,
    scope.branchId ?? '-',
    scope.cashRegisterId ?? '-',
  ].join(':');
}
