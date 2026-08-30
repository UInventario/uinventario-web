import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';

export interface DemandForecastData {
  id: string;
  branch: { id: string; name: string; timezone: string };
  status: 'READY' | 'INSUFFICIENT';
  asOfDate: string;
  horizonDays: number;
  model: 'WEEKDAY_BASELINE_V1';
  assumptions: string[];
  generatedAt: string;
  items: Array<{
    product: { id: string; name: string; sku: string };
    status: 'SUFFICIENT' | 'INSUFFICIENT';
    quality: {
      coverageDays: number;
      daysWithDemand: number;
      totalDemand: number;
      minimum: { coverageDays: number; daysWithDemand: number; totalDemand: number };
      backtest: { samples: number; meanAbsoluteError: number | null };
      drift: { ratio: number | null; status: 'STABLE' | 'WARNING' | 'UNKNOWN' };
    };
    forecast: null | {
      horizonDays: number;
      expectedDemand: number;
      interval: { confidence: 'APPROXIMATE_80'; lower: number; upper: number };
      availableQuantity: number;
      suggestedReorderQuantity: number;
    };
  }>;
  summary: { sufficient: number; insufficient: number; driftWarnings: number };
}

@Injectable({ providedIn: 'root' })
export class DemandForecastApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  latest() {
    return this.http.get<{ data: DemandForecastData | null; meta: { apiVersion: '1' } }>(
      `${this.config.apiBaseUrl()}/forecasting/demand/latest`,
      { withCredentials: true },
    );
  }

  generate(horizonDays: 7 | 14 | 30, idempotencyKey: string) {
    return this.http.post<{
      data: DemandForecastData;
      meta: { apiVersion: '1'; idempotentReplay: boolean };
    }>(
      `${this.config.apiBaseUrl()}/forecasting/demand/runs`,
      { horizonDays },
      {
        withCredentials: true,
        headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
      },
    );
  }
}
