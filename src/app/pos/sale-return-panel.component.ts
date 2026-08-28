import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import {
  CreateSaleReturnInput,
  PosApiService,
  SaleDetailData,
  SaleReturnData,
  SaleSummaryData,
} from './pos-api.service';

const RETURN_QUANTITY_PATTERN =
  /^(?:[1-9]\d{0,14}(?:\.\d{1,3})?|0\.(?:00[1-9]|0[1-9]\d?|[1-9]\d{0,2}))$/;

@Component({
  selector: 'app-sale-return-panel',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './sale-return-panel.component.html',
  styleUrl: './sale-return-panel.component.scss',
})
export class SaleReturnPanelComponent {
  private readonly pos = inject(PosApiService);
  private readonly formBuilder = inject(FormBuilder);
  private pending: { fingerprint: string; key: string } | null = null;

  readonly sale = input.required<SaleDetailData>();
  readonly exchangeOptions = input<SaleSummaryData[]>([]);
  readonly completed = output<SaleReturnData>();

  protected readonly returns = signal<SaleReturnData[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly form = this.formBuilder.nonNullable.group({
    reason: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(240)]],
    exchangeSaleId: [''],
    lines: new FormArray<ReturnType<typeof this.createLineGroup>>([]),
  });

  constructor() {
    effect(() => {
      const sale = this.sale();
      this.resetLines(sale);
      this.loadReturns(sale.id);
    });
  }

  protected available(line: SaleDetailData['lines'][number]): string {
    const returned = this.returns().reduce(
      (sum, item) =>
        sum +
        item.lines
          .filter((returnLine) => returnLine.saleLineId === line.id)
          .reduce((lineSum, returnLine) => lineSum + this.units(returnLine.quantity), 0),
      0,
    );
    return this.quantity(Math.max(0, this.units(line.quantity) - returned));
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const lines = value.lines
      .filter((line) => line.quantity.trim() !== '')
      .map((line) => ({
        saleLineId: line.saleLineId,
        quantity: line.quantity.trim(),
        condition: line.condition,
        serialNumbers: line.serialNumbers
          .split(/[\n,]+/)
          .map((serial) => serial.trim())
          .filter(Boolean),
      }));
    if (lines.length === 0) {
      this.error.set('Indica al menos una cantidad a devolver.');
      return;
    }
    const input: CreateSaleReturnInput = {
      reason: value.reason.trim(),
      exchangeSaleId: value.exchangeSaleId || undefined,
      lines,
    };
    const fingerprint = JSON.stringify(input);
    const key =
      this.pending?.fingerprint === fingerprint
        ? this.pending.key
        : `web-sale-return-${globalThis.crypto.randomUUID()}`;
    this.pending = { fingerprint, key };
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.pos
      .createSaleReturn(this.sale().id, input, key)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.pending = null;
          this.returns.update((items) =>
            items.some((item) => item.id === data.id) ? items : [...items, data],
          );
          this.form.controls.reason.reset('');
          this.form.controls.exchangeSaleId.reset('');
          for (const line of this.form.controls.lines.controls) {
            line.patchValue({ quantity: '', condition: 'SELLABLE', serialNumbers: '' });
          }
          this.success.set(
            data.exchangeSale
              ? `Cambio enlazado con ${data.exchangeSale.receiptNumber}.`
              : 'Devolución registrada; la liquidación monetaria queda pendiente.',
          );
          this.completed.emit(data);
        },
        error: (error: HttpErrorResponse) => {
          if (error.status > 0 && error.status < 500) this.pending = null;
          this.error.set(this.messageFor(error));
          if (error.status === 409) this.loadReturns(this.sale().id);
        },
      });
  }

  private createLineGroup(line?: SaleDetailData['lines'][number]) {
    return this.formBuilder.nonNullable.group({
      saleLineId: [line?.id ?? '', Validators.required],
      quantity: ['', Validators.pattern(RETURN_QUANTITY_PATTERN)],
      condition: ['SELLABLE' as const],
      serialNumbers: [''],
    });
  }

  private resetLines(sale: SaleDetailData): void {
    this.form.controls.lines.clear();
    for (const line of sale.lines) this.form.controls.lines.push(this.createLineGroup(line));
    this.form.controls.reason.reset('');
    this.form.controls.exchangeSaleId.reset('');
    this.error.set(null);
    this.success.set(null);
    this.pending = null;
  }

  private loadReturns(saleId: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.pos
      .listSaleReturns(saleId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ data }) => this.returns.set(data),
        error: (error: HttpErrorResponse) => this.error.set(this.messageFor(error)),
      });
  }

  private messageFor(error: HttpErrorResponse): string {
    const code = (error.error as { code?: string } | null)?.code;
    if (error.status === 403) return 'No tienes permiso para registrar devoluciones.';
    if (error.status === 404) return 'La venta no está disponible en esta sucursal.';
    if (code === 'SALE_RETURN_QUANTITY_EXCEEDED')
      return 'La cantidad supera las unidades pendientes de devolución.';
    if (code === 'SALE_RETURN_EXCHANGE_INVALID')
      return 'La venta elegida para el cambio no es válida o ya fue enlazada.';
    if (code === 'SALE_RETURN_SERIALS_INVALID')
      return 'Revisa las series: deben ser exactamente las unidades vendidas que regresan.';
    if (error.status === 0) return 'No fue posible conectar con el servicio de ventas.';
    return 'No fue posible registrar la devolución.';
  }

  private units(value: string): number {
    return Math.round(Number(value) * 1000);
  }

  private quantity(value: number): string {
    return (value / 1000).toFixed(3);
  }
}
