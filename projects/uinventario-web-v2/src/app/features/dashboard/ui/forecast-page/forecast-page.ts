import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { DashboardFacade } from '../../application/dashboard.facade';
import { DemandForecast } from '../../domain/dashboard.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe],
  selector: 'ui-forecast-page',
  styleUrl: './forecast-page.scss',
  templateUrl: './forecast-page.html',
})
export class ForecastPage implements OnInit {
  private readonly api = inject(DashboardFacade);

  protected readonly result = signal<DemandForecast | null>(null);
  protected readonly loading = signal(true);
  protected readonly generating = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly horizon = signal<7 | 14 | 30>(14);
  protected readonly reorderItems = computed(() =>
    [...(this.result()?.items ?? [])]
      .filter((item) => item.forecast !== null)
      .sort(
        (left, right) =>
          (right.forecast?.suggestedReorderQuantity ?? 0) -
          (left.forecast?.suggestedReorderQuantity ?? 0),
      ),
  );

  ngOnInit(): void {
    this.loadLatest();
  }

  protected selectHorizon(value: string): void {
    this.horizon.set(Number(value) as 7 | 14 | 30);
  }

  protected generate(): void {
    if (this.generating()) return;
    this.generating.set(true);
    this.error.set(null);
    this.api
      .generateForecast(this.horizon())
      .pipe(finalize(() => this.generating.set(false)))
      .subscribe({
        next: (result) => {
          this.result.set(result);
          this.horizon.set(result.horizonDays as 7 | 14 | 30);
        },
        error: (error: unknown) => this.error.set(this.message(error)),
      });
  }

  private loadLatest(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .latestForecast()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => {
          this.result.set(result);
          if (result) this.horizon.set(result.horizonDays as 7 | 14 | 30);
        },
        error: (error: unknown) => this.error.set(this.message(error)),
      });
  }

  private message(error: unknown): string {
    return error instanceof ApiError
      ? error.message
      : 'No fue posible calcular el pronóstico de demanda.';
  }
}
