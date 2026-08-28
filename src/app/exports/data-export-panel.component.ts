import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { SessionApiService } from '../auth/session-api.service';
import {
  DataExportApiService,
  DataExportData,
  DataExportDataset,
  DataExportFormat,
  DataExportRequest,
} from './data-export-api.service';

@Component({
  selector: 'app-data-export-panel',
  imports: [ReactiveFormsModule],
  templateUrl: './data-export-panel.component.html',
  styleUrl: './data-export-panel.component.scss',
})
export class DataExportPanelComponent implements OnDestroy {
  private readonly api = inject(DataExportApiService);
  private readonly sessions = inject(SessionApiService);
  private readonly formBuilder = inject(FormBuilder);
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly job = signal<DataExportData | null>(null);
  protected readonly creating = signal(false);
  protected readonly downloading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly canIncludeSensitive = computed(
    () => this.sessions.session()?.user.permissions.includes('TENANT_MANAGE') ?? false,
  );
  protected readonly form = this.formBuilder.nonNullable.group({
    dataset: 'PRODUCTS' as DataExportDataset,
    format: 'CSV' as DataExportFormat,
    q: '',
    productStatus: 'ALL' as 'ACTIVE' | 'INACTIVE' | 'ALL',
    saleStatus: 'ALL' as 'COMPLETED' | 'VOIDED' | 'ALL',
    dateFrom: '',
    dateTo: '',
    includeSensitive: false,
  });

  protected create(): void {
    if (this.creating()) return;
    const value = this.form.getRawValue();
    const input: DataExportRequest = {
      dataset: value.dataset,
      format: value.format,
      ...(value.q.trim() ? { q: value.q.trim() } : {}),
      ...(value.dataset === 'PRODUCTS' ? { productStatus: value.productStatus } : {}),
      ...(value.dataset === 'SALES' ? { saleStatus: value.saleStatus } : {}),
      ...(['SALES', 'MOVEMENTS'].includes(value.dataset) && value.dateFrom
        ? { dateFrom: value.dateFrom }
        : {}),
      ...(['SALES', 'MOVEMENTS'].includes(value.dataset) && value.dateTo
        ? { dateTo: value.dateTo }
        : {}),
      ...(this.canIncludeSensitive() && value.includeSensitive ? { includeSensitive: true } : {}),
    };
    this.clearPoll();
    this.error.set(null);
    this.job.set(null);
    this.creating.set(true);
    this.api
      .create(input)
      .pipe(finalize(() => this.creating.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.job.set(data);
          this.schedulePoll(data);
        },
        error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
      });
  }

  protected retry(): void {
    const job = this.job();
    if (!job || job.status !== 'FAILED' || this.creating()) return;
    this.error.set(null);
    this.creating.set(true);
    this.api
      .retry(job.id)
      .pipe(finalize(() => this.creating.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.job.set(data);
          this.schedulePoll(data);
        },
        error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
      });
  }

  protected download(): void {
    const job = this.job();
    if (!job?.downloadReady || this.downloading()) return;
    this.downloading.set(true);
    this.error.set(null);
    this.api
      .download(job.id)
      .pipe(finalize(() => this.downloading.set(false)))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${job.dataset.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.${job.format.toLowerCase()}`;
          link.click();
          URL.revokeObjectURL(url);
        },
        error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
      });
  }

  protected datasetChanged(): void {
    this.job.set(null);
    this.error.set(null);
    this.clearPoll();
  }

  ngOnDestroy(): void {
    this.clearPoll();
  }

  private schedulePoll(job: DataExportData): void {
    if (!['PENDING', 'PROCESSING'].includes(job.status)) return;
    this.clearPoll();
    this.pollTimer = setTimeout(() => {
      this.api.get(job.id).subscribe({
        next: ({ data }) => {
          this.job.set(data);
          this.schedulePoll(data);
        },
        error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
      });
    }, 800);
  }

  private clearPoll(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
  }

  private message(error: HttpErrorResponse): string {
    const code = (error.error as { code?: string } | null)?.code;
    if (code === 'SENSITIVE_EXPORT_FORBIDDEN')
      return 'No tienes permiso para incluir datos sensibles.';
    if (code === 'EXPORT_CONTEXT_REQUIRED')
      return 'Selecciona una sucursal y bodega antes de exportar.';
    if (error.status === 0) return 'No fue posible conectar con el servicio de exportaciones.';
    return 'No fue posible generar la exportación.';
  }
}
