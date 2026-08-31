import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { ApiError } from '../../../../../core/api/api-error';
import { PosFacade } from '../../application/pos.facade';
import { PosCartLine, PosInventoryLot, PosInventorySerial } from '../../domain/pos.models';
import { normalizeQuantity } from '../../domain/quantity';

const MONEY_PATTERN = /^(?:[1-9]\d{0,11}(?:\.\d{1,2})?|0\.(?:0[1-9]|[1-9]\d?))$/;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  selector: 'ui-pos-line-dialog',
  styleUrls: ['./pos-line-dialog.scss', './pos-line-tracking.scss'],
  templateUrl: './pos-line-dialog.html',
})
export class PosLineDialog implements OnInit {
  private readonly facade = inject(PosFacade);
  readonly line = input.required<PosCartLine>();
  readonly canOverridePrice = input(false);
  readonly canDiscount = input(false);
  readonly canOverrideExpired = input(false);
  readonly closed = output<void>();
  readonly submitted = output<PosCartLine>();

  protected readonly error = signal<string | null>(null);
  protected readonly trackingLoading = signal(false);
  protected readonly lots = signal<readonly PosInventoryLot[]>([]);
  protected readonly serials = signal<readonly PosInventorySerial[]>([]);
  protected readonly form = new FormBuilder().nonNullable.group({
    quantity: ['', Validators.required],
    note: ['', Validators.maxLength(240)],
    manualUnitPrice: ['', Validators.pattern(MONEY_PATTERN)],
    priceOverrideReason: ['', Validators.maxLength(240)],
    discountEnabled: [false],
    discountType: ['PERCENT' as 'PERCENT' | 'AMOUNT'],
    discountValue: ['', Validators.pattern(MONEY_PATTERN)],
    discountReason: ['', Validators.maxLength(240)],
    lotId: [''],
    expiredLotOverrideReason: ['', Validators.maxLength(240)],
    serialNumbers: [[] as string[]],
  });

  ngOnInit(): void {
    const line = this.line();
    this.form.reset({
      quantity: line.quantity,
      note: line.note ?? '',
      manualUnitPrice: this.canOverridePrice() ? (line.manualUnitPrice ?? '') : '',
      priceOverrideReason: this.canOverridePrice() ? (line.priceOverrideReason ?? '') : '',
      discountEnabled: this.canDiscount() && Boolean(line.discount),
      discountType: line.discount?.type ?? 'PERCENT',
      discountValue: this.canDiscount() ? (line.discount?.value ?? '') : '',
      discountReason: this.canDiscount() ? (line.discount?.reason ?? '') : '',
      lotId: line.lotId ?? '',
      expiredLotOverrideReason: line.expiredLotOverrideReason ?? '',
      serialNumbers: [...(line.serialNumbers ?? [])],
    });
    this.loadTracking();
  }

  protected currentLot(): PosInventoryLot | null {
    const id = this.form.controls.lotId.value;
    return this.lots().find((lot) => lot.id === id) ?? null;
  }

  protected canUseLot(lot: PosInventoryLot): boolean {
    if (lot.expirationStatus !== 'EXPIRED') return lot.expirationStatus !== 'EXHAUSTED';
    return Boolean(this.line().product.allowExpiredStockOverride && this.canOverrideExpired());
  }

  protected toggleSerial(serialNumber: string, checked: boolean): void {
    const current = this.form.controls.serialNumbers.value;
    this.form.controls.serialNumbers.setValue(
      checked
        ? [...new Set([...current, serialNumber])]
        : current.filter((candidate) => candidate !== serialNumber),
    );
  }

  protected submit(): void {
    if (this.trackingLoading()) return;
    const value = this.form.getRawValue();
    const quantity = normalizeQuantity(value.quantity, this.line().product);
    if (!quantity) {
      this.error.set(
        `Usa una cantidad mínima de ${this.line().product.minimumQuantity} con hasta ${this.line().product.quantityPrecision} decimales.`,
      );
      return;
    }
    const selectedLot = this.currentLot();
    if (this.line().product.trackLots && !selectedLot) {
      this.error.set('Selecciona el lote que se descontará en esta venta.');
      return;
    }
    if (selectedLot?.expirationStatus === 'EXPIRED') {
      if (!this.canUseLot(selectedLot)) {
        this.error.set('Este lote está vencido y su venta no está autorizada.');
        return;
      }
      if (value.expiredLotOverrideReason.trim().length < 3) {
        this.error.set('Explica por qué se autoriza vender el lote vencido.');
        return;
      }
    }
    if (
      this.line().product.trackSerials &&
      (!Number.isInteger(Number(quantity)) || value.serialNumbers.length !== Number(quantity))
    ) {
      this.error.set(`Selecciona exactamente ${quantity} serie(s) disponible(s).`);
      return;
    }
    if (
      this.form.invalid ||
      (this.canOverridePrice() &&
        value.manualUnitPrice &&
        value.priceOverrideReason.trim().length < 3) ||
      (this.canDiscount() &&
        value.discountEnabled &&
        (!value.discountValue ||
          value.discountReason.trim().length < 3 ||
          (value.discountType === 'PERCENT' && Number(value.discountValue) > 100)))
    ) {
      this.form.markAllAsTouched();
      this.error.set('Revisa la cantidad, precio y motivo del cambio.');
      return;
    }
    const note = value.note.trim();
    const manualUnitPrice = this.canOverridePrice() ? value.manualUnitPrice.trim() : '';
    const priceOverrideReason = this.canOverridePrice() ? value.priceOverrideReason.trim() : '';
    this.submitted.emit({
      product: this.line().product,
      quantity,
      ...(note ? { note } : {}),
      ...(manualUnitPrice ? { manualUnitPrice, priceOverrideReason } : {}),
      ...(this.canDiscount() && value.discountEnabled
        ? {
            discount: {
              type: value.discountType,
              value: value.discountValue.trim(),
              reason: value.discountReason.trim(),
            },
          }
        : {}),
      ...(selectedLot ? { lotId: selectedLot.id } : {}),
      ...(selectedLot?.expirationStatus === 'EXPIRED'
        ? { expiredLotOverrideReason: value.expiredLotOverrideReason.trim() }
        : {}),
      ...(value.serialNumbers.length ? { serialNumbers: value.serialNumbers } : {}),
    });
  }

  private loadTracking(): void {
    const product = this.line().product;
    if (!product.trackLots && !product.trackSerials) return;
    this.trackingLoading.set(true);
    forkJoin({
      lots: product.trackLots ? this.facade.listLots(product.id) : of([]),
      serials: product.trackSerials ? this.facade.listSerials(product.id) : of([]),
    }).subscribe({
      next: ({ lots, serials }) => {
        this.lots.set(lots);
        this.serials.set(serials);
        this.trackingLoading.set(false);
      },
      error: (error: unknown) => {
        this.trackingLoading.set(false);
        this.error.set(
          error instanceof ApiError ? error.message : 'No fue posible cargar lotes o series.',
        );
      },
    });
  }
}
