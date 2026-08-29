import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';

export interface LoyaltyRuleData {
  id: string;
  version: number;
  active: boolean;
  earnAmount: string;
  earnPoints: number;
  redeemPoints: number;
  redeemAmount: string;
  expirationDays: number | null;
  createdAt: string;
}

export interface LoyaltyStatementData {
  customer: { id: string; name: string };
  rule: LoyaltyRuleData | null;
  balance: number;
  entries: Array<{
    id: string;
    type:
      | 'EARN'
      | 'REDEEM'
      | 'EXPIRE'
      | 'VOID_EARN_REVERSAL'
      | 'VOID_REDEEM_RESTORE'
      | 'RETURN_EARN_REVERSAL'
      | 'RETURN_REDEEM_RESTORE';
    points: number;
    monetaryValue: string;
    sale: { id: string; receiptNumber: string } | null;
    saleReturnId: string | null;
    expiresAt: string | null;
    createdAt: string;
  }>;
}

export interface LoyaltyRuleInput {
  active: boolean;
  earnAmount: string;
  earnPoints: number;
  redeemPoints: number;
  redeemAmount: string;
  expirationDays?: number;
}

@Injectable({ providedIn: 'root' })
export class LoyaltyApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  currentRule() {
    return this.http.get<{ data: LoyaltyRuleData | null; meta: { apiVersion: '1' } }>(
      `${this.config.apiBaseUrl()}/loyalty/rules/current`,
      { withCredentials: true },
    );
  }

  saveRule(input: LoyaltyRuleInput) {
    return this.http.put<{ data: LoyaltyRuleData; meta: { apiVersion: '1' } }>(
      `${this.config.apiBaseUrl()}/loyalty/rules/current`,
      input,
      { withCredentials: true },
    );
  }

  statement(customerId: string) {
    return this.http.get<{ data: LoyaltyStatementData; meta: { apiVersion: '1' } }>(
      `${this.config.apiBaseUrl()}/loyalty/customers/${customerId}`,
      { withCredentials: true },
    );
  }
}
