import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Subscription, catchError, finalize, forkJoin, of, timer } from 'rxjs';
import { ApiError } from '../../../../../core/api/api-error';
import { AuthorizationService } from '../../../../../core/authorization/authorization.service';
import { downloadFile } from '../../../application/csv-export';
import { ControlFacade } from '../../application/control.facade';
import { dataExportDownloadable, dataExportExpired } from '../../application/data-export-policy';
import {
  CreateDataExportInput,
  DataExportDataset,
  DataExportJob,
} from '../../domain/control.models';
import { ExportJobRegistry } from '../../data/export-job-registry';

interface DatasetOption {
  readonly value: DataExportDataset;
  readonly label: string;
  readonly description: string;
}

const DATASETS: readonly DatasetOption[] = [
  { value: 'PRODUCTS', label: 'Productos', description: 'Catálogo, precios y estado.' },
  { value: 'STOCK', label: 'Existencias', description: 'Stock de la sucursal y bodega activas.' },
  { value: 'SALES', label: 'Ventas', description: 'Folios, pagos y totales del periodo.' },
  { value: 'MOVEMENTS', label: 'Movimientos', description: 'Entradas, salidas y ajustes.' },
];

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ReactiveFormsModule],
  selector: 'ui-data-exports-page',
  styleUrls: ['../../../ui/report-view.scss', './data-exports-page.scss'],
  templateUrl: './data-exports-page.html',
})
export class DataExportsPage implements OnInit, OnDestroy {
  private readonly facade = inject(ControlFacade);
  private readonly authorization = inject(AuthorizationService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly registry = inject(ExportJobRegistry);
  private polling: Subscription | null = null;
  private refreshing = false;

  protected readonly availableDatasets = computed(() =>
    DATASETS.filter(({ value }) => this.datasetAllowed(value)),
  );
  protected readonly canIncludeSensitive = computed(() => this.authorization.has('TENANT_MANAGE'));
  protected readonly form = this.formBuilder.nonNullable.group({
    dataset: 'PRODUCTS' as DataExportDataset,
    format: 'CSV' as 'CSV' | 'XLSX',
    q: '',
    productStatus: 'ALL' as 'ACTIVE' | 'INACTIVE' | 'ALL',
    saleStatus: 'ALL' as 'COMPLETED' | 'VOIDED' | 'ALL',
    movementType: '',
    dateFrom: '',
    dateTo: '',
    includeSensitive: false,
  });
  protected readonly jobs = signal<readonly DataExportJob[]>([]);
  protected readonly loading = signal(true);
  protected readonly acting = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  ngOnInit(): void {
    const first = this.availableDatasets()[0]?.value;
    if (first && !this.datasetAllowed(this.form.controls.dataset.value)) {
      this.form.controls.dataset.setValue(first);
    }
    this.restoreJobs();
  }

  ngOnDestroy(): void {
    this.polling?.unsubscribe();
  }

  protected create(): void {
    const value = this.form.getRawValue();
    if (!this.datasetAllowed(value.dataset)) {
      this.error.set('No tienes permiso para exportar ese conjunto de datos.');
      return;
    }
    const usesPeriod = value.dataset === 'SALES' || value.dataset === 'MOVEMENTS';
    if (usesPeriod && value.dateFrom && value.dateTo && value.dateFrom > value.dateTo) {
      this.error.set('La fecha inicial no puede ser posterior a la fecha final.');
      return;
    }
    const input = this.exportInput(value);
    this.acting.set('create');
    this.error.set(null);
    this.notice.set(null);
    this.facade
      .createExport(input)
      .pipe(finalize(() => this.acting.set(null)))
      .subscribe({
        next: (job) => {
          this.registry.remember(job.id);
          this.upsert(job);
          this.notice.set(
            'Exportación solicitada. Puedes continuar trabajando mientras se genera.',
          );
          this.startPolling();
        },
        error: (error: unknown) => this.error.set(this.message(error)),
      });
  }

  protected retry(job: DataExportJob): void {
    if (this.acting()) return;
    this.acting.set(job.id);
    this.error.set(null);
    this.facade
      .retryExport(job.id)
      .pipe(finalize(() => this.acting.set(null)))
      .subscribe({
        next: (updated) => {
          this.upsert(updated);
          this.notice.set('La exportación se volvió a poner en cola.');
          this.startPolling();
        },
        error: (error: unknown) => this.error.set(this.message(error)),
      });
  }

  protected download(job: DataExportJob): void {
    if (!this.downloadable(job) || this.acting()) return;
    this.acting.set(job.id);
    this.error.set(null);
    this.facade
      .downloadExport(job.id)
      .pipe(finalize(() => this.acting.set(null)))
      .subscribe({
        next: (file) => {
          downloadFile(file.content, this.filename(file.filename, job));
          this.notice.set('Descarga iniciada.');
        },
        error: (error: unknown) => this.error.set(this.message(error)),
      });
  }

  protected remove(job: DataExportJob): void {
    this.registry.forget(job.id);
    this.jobs.update((jobs) => jobs.filter(({ id }) => id !== job.id));
  }

  protected downloadable(job: DataExportJob): boolean {
    return dataExportDownloadable(job);
  }

  protected expired(job: DataExportJob): boolean {
    return dataExportExpired(job);
  }

  protected progress(job: DataExportJob): number {
    return { PENDING: 20, PROCESSING: 65, COMPLETED: 100, FAILED: 100, EXPIRED: 100 }[job.status];
  }

  protected statusLabel(job: DataExportJob): string {
    return {
      PENDING: 'En cola',
      PROCESSING: 'Generando',
      COMPLETED: 'Lista',
      FAILED: 'Falló',
      EXPIRED: 'Caducó',
    }[job.status];
  }

  protected datasetLabel(dataset: DataExportDataset): string {
    return DATASETS.find(({ value }) => value === dataset)?.label ?? dataset;
  }

  protected errorLabel(code: string | null): string {
    return code === 'EXPORT_ROW_LIMIT_EXCEEDED'
      ? 'La consulta supera 100,000 filas. Reduce los filtros.'
      : 'No fue posible generar el archivo.';
  }

  private restoreJobs(): void {
    const ids = this.registry.list();
    if (!ids.length) {
      this.loading.set(false);
      return;
    }
    this.refresh(ids, true);
  }

  private refresh(ids: readonly string[], initial = false): void {
    if (this.refreshing || !ids.length) return;
    this.refreshing = true;
    forkJoin(
      ids.map((id) =>
        this.facade.exportJob(id).pipe(
          catchError((error: unknown) => {
            if (error instanceof ApiError && [404, 410].includes(error.status)) {
              this.registry.forget(id);
            } else if (initial) {
              this.error.set(this.message(error));
            }
            return of(null);
          }),
        ),
      ),
    )
      .pipe(
        finalize(() => {
          this.refreshing = false;
          if (initial) this.loading.set(false);
        }),
      )
      .subscribe((jobs) => {
        for (const job of jobs) if (job) this.upsert(job);
        this.startPolling();
      });
  }

  private startPolling(): void {
    if (!this.jobs().some((job) => job.status === 'PENDING' || job.status === 'PROCESSING')) {
      this.polling?.unsubscribe();
      this.polling = null;
      return;
    }
    if (this.polling && !this.polling.closed) return;
    this.polling = timer(2_000, 2_000).subscribe(() => {
      const active = this.jobs()
        .filter((job) => job.status === 'PENDING' || job.status === 'PROCESSING')
        .map(({ id }) => id);
      if (active.length) this.refresh(active);
      else {
        this.polling?.unsubscribe();
        this.polling = null;
      }
    });
  }

  private upsert(job: DataExportJob): void {
    this.jobs.update((jobs) =>
      [job, ...jobs.filter(({ id }) => id !== job.id)].sort(
        (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
      ),
    );
  }

  private datasetAllowed(dataset: DataExportDataset): boolean {
    if (this.authorization.has('TENANT_MANAGE')) return true;
    if (dataset === 'PRODUCTS') return this.authorization.has('PRODUCTS_MANAGE');
    if (dataset === 'SALES') return this.authorization.has('SALES_MANAGE');
    return this.authorization.has('INVENTORY_VIEW');
  }

  private filename(serverName: string, job: DataExportJob): string {
    if (serverName !== 'exportacion') return serverName;
    const date = (job.completedAt ?? new Date().toISOString()).slice(0, 10);
    return `${job.dataset.toLowerCase()}-${date}.${job.format.toLowerCase()}`;
  }

  private exportInput(
    value: typeof this.form.value & Record<string, unknown>,
  ): CreateDataExportInput {
    const dataset = value['dataset'] as DataExportDataset;
    const q = clean(value['q']);
    const dateFrom = clean(value['dateFrom']);
    const dateTo = clean(value['dateTo']);
    return {
      dataset,
      format: value['format'] as 'CSV' | 'XLSX',
      includeSensitive:
        this.canIncludeSensitive() &&
        Boolean(value['includeSensitive']) &&
        (dataset === 'SALES' || dataset === 'MOVEMENTS'),
      ...(q ? { q } : {}),
      ...(dateFrom && (dataset === 'SALES' || dataset === 'MOVEMENTS') ? { dateFrom } : {}),
      ...(dateTo && (dataset === 'SALES' || dataset === 'MOVEMENTS') ? { dateTo } : {}),
      ...(dataset === 'PRODUCTS'
        ? { productStatus: value['productStatus'] as 'ACTIVE' | 'INACTIVE' | 'ALL' }
        : {}),
      ...(dataset === 'SALES'
        ? { saleStatus: value['saleStatus'] as 'COMPLETED' | 'VOIDED' | 'ALL' }
        : {}),
      ...(dataset === 'MOVEMENTS' && clean(value['movementType'])
        ? { movementType: clean(value['movementType']) }
        : {}),
    };
  }

  private message(error: unknown): string {
    return error instanceof ApiError ? error.message : 'No fue posible gestionar la exportación.';
  }
}

function clean(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() || undefined : undefined;
}
