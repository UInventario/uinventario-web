import { ApiEnvelope } from '../api/api-contracts';
import { AppPermission } from '../authorization/app-permission';

export interface SessionData {
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly roles: readonly string[];
    readonly permissions: readonly AppPermission[];
  };
  readonly tenant: { readonly id: string; readonly name: string };
  readonly context: {
    readonly branch: { readonly id: string; readonly name: string } | null;
    readonly warehouse: { readonly id: string; readonly name: string } | null;
    readonly cashRegister: {
      readonly id: string;
      readonly name: string;
      readonly code: string;
    } | null;
  };
  readonly nextStep: 'ONBOARDING' | 'APPLICATION';
}

export type SessionResponse = ApiEnvelope<
  SessionData,
  { readonly apiVersion: '1'; readonly sessionExpiresAt: string }
>;

export interface LoginInput {
  readonly email: string;
  readonly password: string;
}

export interface SessionContextInput {
  readonly branchId: string;
  readonly warehouseId: string;
  readonly cashRegisterId?: string;
}
