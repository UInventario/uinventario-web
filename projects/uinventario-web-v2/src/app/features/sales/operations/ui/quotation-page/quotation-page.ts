import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { finalize, forkJoin } from 'rxjs';
import { ApiError } from '../../../../../core/api/api-error';
import { SalesOperationsFacade } from '../../application/sales-operations.facade';
import { salesOperationError } from '../../application/operations-error';
import { OperationOptions } from '../../domain/operations.models';
import {
  ConvertQuotationInput,
  QuotationInput,
  QuotationPage,
  QuotationPreview,
  QuotationStatus,
  SalesQuotation,
} from '../../domain/quotation.models';
import { ProductReservation } from '../../domain/reservation.models';
import { QuotationConvertDialog } from '../quotation-convert-dialog/quotation-convert-dialog';
import { QuotationEditorDialog } from '../quotation-editor-dialog/quotation-editor-dialog';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, QuotationConvertDialog, QuotationEditorDialog],
  selector: 'ui-quotation-page',
  styleUrls: ['../operations-page.scss'],
  templateUrl: './quotation-page.html',
})
export class QuotationPageComponent implements OnInit {
  private readonly facade = inject(SalesOperationsFacade);
  protected readonly options = signal<OperationOptions | null>(null);
  protected readonly reservations = signal<readonly ProductReservation[]>([]);
  protected readonly result = signal<QuotationPage | null>(null);
  protected readonly status = signal<QuotationStatus | ''>('');
  protected readonly editorOpen = signal(false);
  protected readonly editing = signal<SalesQuotation | null>(null);
  protected readonly preview = signal<QuotationPreview | null>(null);
  protected readonly loading = signal(true);
  protected readonly acting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly conversionError = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  ngOnInit(): void {
    forkJoin({
      options: this.facade.options(),
      reservations: this.facade.reservations(),
      quotations: this.facade.quotations(undefined, 1),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ options, reservations, quotations }) => {
          this.options.set(options);
          this.reservations.set(reservations.filter(({ status }) => status === 'ACTIVE'));
          this.result.set(quotations);
        },
        error: (error: unknown) =>
          this.error.set(salesOperationError(error, 'No fue posible cargar las cotizaciones.')),
      });
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.editorOpen.set(true);
    this.clearMessages();
  }

  protected openEdit(quotation: SalesQuotation): void {
    this.editing.set(quotation);
    this.editorOpen.set(true);
    this.clearMessages();
  }

  protected save(event: { readonly input: QuotationInput; readonly version?: number }): void {
    if (this.acting()) return;
    this.acting.set(true);
    this.error.set(null);
    const current = this.editing();
    const request = current
      ? this.facade.updateQuotation(current.id, event.input, event.version ?? current.version)
      : this.facade.createQuotation(event.input);
    request.pipe(finalize(() => this.acting.set(false))).subscribe({
      next: (quotation) => {
        this.editorOpen.set(false);
        this.notice.set(`Cotización ${quotation.quotationNumber} guardada.`);
        this.load(this.result()?.pagination.page ?? 1);
      },
      error: (error: unknown) =>
        this.error.set(salesOperationError(error, 'No fue posible guardar la cotización.')),
    });
  }

  protected openPreview(quotation: SalesQuotation): void {
    if (this.acting()) return;
    this.acting.set(true);
    this.clearMessages();
    this.facade
      .previewQuotation(quotation.id)
      .pipe(finalize(() => this.acting.set(false)))
      .subscribe({
        next: (preview) => this.preview.set(preview),
        error: (error: unknown) =>
          this.error.set(salesOperationError(error, 'No fue posible recalcular la cotización.')),
      });
  }

  protected convert(input: ConvertQuotationInput): void {
    const preview = this.preview();
    if (!preview || this.acting()) return;
    this.acting.set(true);
    this.conversionError.set(null);
    this.facade
      .convertQuotation(preview.quotation.id, input)
      .pipe(finalize(() => this.acting.set(false)))
      .subscribe({
        next: (conversion) => {
          this.preview.set(null);
          this.notice.set(
            `${conversion.quotation.quotationNumber} convertida en ${conversion.sale.receiptNumber}.`,
          );
          this.load(this.result()?.pagination.page ?? 1);
        },
        error: (error: unknown) => {
          this.conversionError.set(
            salesOperationError(error, 'No fue posible convertir la cotización.'),
          );
          if (
            error instanceof ApiError &&
            ['QUOTATION_CHANGED', 'QUOTATION_STOCK_CHANGED', 'QUOTATION_VERSION_CONFLICT'].includes(
              error.code,
            )
          ) {
            this.refreshPreview(preview.quotation.id);
          }
        },
      });
  }

  protected filter(value: string): void {
    this.status.set(value as QuotationStatus | '');
    this.load(1);
  }

  protected goToPage(page: number): void {
    this.load(page);
  }

  protected statusLabel(status: QuotationStatus): string {
    return {
      ACTIVE: 'Vigente',
      EXPIRED: 'Vencida',
      CONVERTING: 'Convirtiendo',
      CONVERTED: 'Convertida',
    }[status];
  }

  private load(page: number): void {
    this.loading.set(true);
    this.facade
      .quotations(this.status() || undefined, page)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => this.result.set(result),
        error: (error: unknown) =>
          this.error.set(salesOperationError(error, 'No fue posible actualizar las cotizaciones.')),
      });
  }

  private refreshPreview(id: string): void {
    this.facade.previewQuotation(id).subscribe({ next: (preview) => this.preview.set(preview) });
  }

  private clearMessages(): void {
    this.error.set(null);
    this.conversionError.set(null);
    this.notice.set(null);
  }
}
