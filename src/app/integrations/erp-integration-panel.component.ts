import { DatePipe, JsonPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { finalize, forkJoin } from 'rxjs';
import {
  ErpContractData,
  ErpExportData,
  ErpImportRunData,
  ErpIntegrationApiService,
  ErpMappingData,
  ErpMappingResult,
  ErpResource,
} from './erp-integration-api.service';

@Component({
  selector: 'app-erp-integration-panel',
  imports: [DatePipe, JsonPipe],
  templateUrl: './erp-integration-panel.component.html',
  styleUrl: './erp-integration-panel.component.scss',
})
export class ErpIntegrationPanelComponent implements OnInit {
  private readonly api = inject(ErpIntegrationApiService);

  protected readonly provider = signal('SIMULATOR');
  protected readonly contract = signal<ErpContractData | null>(null);
  protected readonly resource = signal<ErpResource>('PRODUCT');
  protected readonly exports = signal<ErpExportData[]>([]);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly hasMore = signal(false);
  protected readonly mappings = signal<ErpMappingData[]>([]);
  protected readonly runs = signal<ErpImportRunData[]>([]);
  protected readonly importResults = signal<ErpMappingResult[]>([]);
  protected readonly mappingLines = signal('');
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    if (!this.validProvider()) return;
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      contract: this.api.contract(),
      mappings: this.api.mappings(this.provider()),
      runs: this.api.runs(this.provider()),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ contract, mappings, runs }) => {
          this.contract.set(contract.data);
          this.mappings.set(mappings.data);
          this.runs.set(runs.data);
        },
        error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
      });
  }

  protected exportPage(append = false): void {
    if (!this.validProvider() || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.api
      .export(
        this.provider(),
        this.resource(),
        append ? (this.nextCursor() ?? undefined) : undefined,
      )
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: ({ data, meta }) => {
          this.exports.update((current) => (append ? [...current, ...data] : data));
          this.nextCursor.set(meta.nextCursor);
          this.hasMore.set(meta.hasMore);
          this.success.set(`${data.length} registro(s) exportados en orden incremental.`);
        },
        error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
      });
  }

  protected importMappings(): void {
    if (!this.validProvider() || this.busy()) return;
    const records = this.parseMappings();
    if (!records) return;
    this.busy.set(true);
    this.error.set(null);
    this.success.set(null);
    this.api
      .importMappings(this.provider(), records)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.importResults.set(data.results);
          this.success.set(
            `Lote completado: ${data.summary.linked} enlazado(s), ${data.summary.failed} error(es).`,
          );
          this.reload();
        },
        error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
      });
  }

  protected setProvider(value: string): void {
    this.provider.set(value.toUpperCase());
    this.resetExport();
  }

  protected selectResource(value: string): void {
    this.resource.set(value as ErpResource);
    this.resetExport();
  }

  private resetExport(): void {
    this.exports.set([]);
    this.nextCursor.set(null);
    this.hasMore.set(false);
  }

  private parseMappings(): Array<{
    resource: ErpResource;
    externalId: string;
    internalId: string;
  }> | null {
    const allowed = new Set(this.contract()?.resources.map(({ resource }) => resource) ?? []);
    const records = this.mappingLines()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(',').map((value) => value.trim()));
    if (
      records.length === 0 ||
      records.length > 100 ||
      records.some(
        ([resource, externalId, internalId]) =>
          !allowed.has(resource as ErpResource) || !externalId || !internalId,
      )
    ) {
      this.error.set('Usa una línea por mapeo: RECURSO,ID_EXTERNO,UUID_INTERNO.');
      return null;
    }
    return records.map(([resource, externalId, internalId]) => ({
      resource: resource as ErpResource,
      externalId,
      internalId,
    }));
  }

  private validProvider(): boolean {
    if (/^[A-Z][A-Z0-9_-]{1,31}$/.test(this.provider())) return true;
    this.error.set('El proveedor debe usar mayúsculas, números, guion o guion bajo.');
    return false;
  }

  private message(error: HttpErrorResponse): string {
    if (error.status === 403) return 'No tienes permiso para administrar integraciones ERP.';
    if (error.status === 409) return 'La clave idempotente o un mapeo tiene datos incompatibles.';
    if (error.status === 0) return 'No fue posible conectar con la API ERP.';
    return 'No fue posible completar la operación ERP.';
  }
}
