import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { SalesOperationsFacade } from '../../application/sales-operations.facade';
import { salesOperationError } from '../../application/operations-error';
import {
  CartQuote,
  OperationLineInput,
  OperationOptions,
  PaymentMethod,
  SalesChannel,
} from '../../domain/operations.models';
import { CreateCustomerOrderInput, CustomerOrderPriority } from '../../domain/order.models';
import { OperationLinesEditor } from '../operation-lines-editor/operation-lines-editor';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OperationLinesEditor, ReactiveFormsModule],
  selector: 'ui-order-editor-dialog',
  styleUrls: ['../operations-dialog.scss', './order-editor-dialog.scss'],
  templateUrl: './order-editor-dialog.html',
})
export class OrderEditorDialog {
  private readonly facade = inject(SalesOperationsFacade);
  private readonly formBuilder = inject(FormBuilder);
  readonly options = input.required<OperationOptions>();
  readonly busy = input(false);
  readonly apiError = input<string | null>(null);
  readonly cancelled = output<void>();
  readonly submitted = output<CreateCustomerOrderInput>();

  protected readonly lines = signal<readonly OperationLineInput[]>([
    { productId: '', quantity: '1' },
  ]);
  protected readonly quote = signal<CartQuote | null>(null);
  protected readonly quoting = signal(false);
  protected readonly error = signal<string | null>(null);
  private quotedSignature: string | null = null;
  protected readonly form = this.formBuilder.nonNullable.group({
    customerId: '',
    locationId: '',
    channel: 'WEB' as SalesChannel,
    priority: 'NORMAL' as CustomerOrderPriority,
    expiresInHours: 48,
    method: 'PICKUP' as 'PICKUP' | 'DELIVERY',
    windowStart: localDate(new Date(Date.now() + 2 * 3_600_000).toISOString()),
    windowEnd: localDate(new Date(Date.now() + 4 * 3_600_000).toISOString()),
    deliveryCost: '0.00',
    recipientName: '',
    recipientPhone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    region: '',
    postalCode: '',
    countryCode: 'MX',
    carrierCode: 'SIMULATED' as 'SIMULATED' | 'SIMULATED_RETRY',
    paymentMethod: 'CASH' as PaymentMethod,
    amountReceived: '',
    reference: '',
  });

  protected calculate(): void {
    const value = this.form.getRawValue();
    if (!value.customerId || !validLines(this.lines())) {
      this.error.set('Selecciona cliente y completa productos únicos con cantidades válidas.');
      return;
    }
    const signature = this.signature();
    this.quoting.set(true);
    this.error.set(null);
    this.facade
      .quoteCart({ customerId: value.customerId, channel: value.channel, lines: this.lines() })
      .pipe(finalize(() => this.quoting.set(false)))
      .subscribe({
        next: (quote) => {
          this.quote.set(quote);
          this.quotedSignature = signature;
        },
        error: (error: unknown) =>
          this.error.set(salesOperationError(error, 'No fue posible calcular el pedido.')),
      });
  }

  protected submit(): void {
    const value = this.form.getRawValue();
    const quote = this.quote();
    if (!value.customerId || !value.locationId || !validLines(this.lines())) {
      this.error.set('Selecciona cliente, ubicación y productos válidos.');
      return;
    }
    if (!quote || this.quotedSignature !== this.signature()) {
      this.error.set('Calcula nuevamente el total después de cambiar cliente o productos.');
      return;
    }
    const start = new Date(value.windowStart);
    const end = new Date(value.windowEnd);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) {
      this.error.set('La ventana de entrega no es válida.');
      return;
    }
    const nowWithTolerance = Date.now() - 5 * 60_000;
    if (start.getTime() < nowWithTolerance || end.getTime() - start.getTime() > 7 * 86_400_000) {
      this.error.set('La ventana debe iniciar ahora o después y durar como máximo 7 días.');
      return;
    }
    if (
      !Number.isInteger(value.expiresInHours) ||
      value.expiresInHours < 1 ||
      value.expiresInHours > 720
    ) {
      this.error.set('La vigencia de la reserva debe estar entre 1 y 720 horas.');
      return;
    }
    if (
      value.method === 'DELIVERY' &&
      !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value.deliveryCost)
    ) {
      this.error.set('El costo de despacho debe ser un importe válido.');
      return;
    }
    if (
      value.paymentMethod === 'CASH' &&
      Number(value.amountReceived) < Number(quote.totals.total)
    ) {
      this.error.set('El efectivo planeado debe cubrir el total del pedido.');
      return;
    }
    if (value.paymentMethod !== 'CASH' && value.reference.trim().length < 4) {
      this.error.set('Indica una referencia de pago válida.');
      return;
    }
    if (
      value.method === 'DELIVERY' &&
      (!value.recipientName.trim() ||
        !value.recipientPhone.trim() ||
        !value.addressLine1.trim() ||
        !value.city.trim() ||
        !value.region.trim() ||
        !value.postalCode.trim())
    ) {
      this.error.set('Completa destinatario y dirección para el despacho.');
      return;
    }
    this.submitted.emit({
      channel: value.channel,
      customerId: value.customerId,
      locationId: value.locationId,
      priority: value.priority,
      expiresInHours: value.expiresInHours,
      fulfillment: {
        method: value.method,
        windowStart: start.toISOString(),
        windowEnd: end.toISOString(),
        deliveryCost: value.method === 'DELIVERY' ? value.deliveryCost : '0.00',
        ...(value.method === 'DELIVERY'
          ? {
              recipientName: value.recipientName.trim(),
              recipientPhone: value.recipientPhone.trim(),
              addressLine1: value.addressLine1.trim(),
              ...(value.addressLine2.trim() ? { addressLine2: value.addressLine2.trim() } : {}),
              city: value.city.trim(),
              region: value.region.trim(),
              postalCode: value.postalCode.trim(),
              countryCode: value.countryCode,
              carrierCode: value.carrierCode,
            }
          : {}),
      },
      lines: this.lines(),
      payments: [
        value.paymentMethod === 'CASH'
          ? { method: value.paymentMethod, amountReceived: value.amountReceived }
          : { method: value.paymentMethod, reference: value.reference.trim() },
      ],
    });
  }

  private signature(): string {
    const value = this.form.getRawValue();
    return JSON.stringify({
      customerId: value.customerId,
      channel: value.channel,
      lines: this.lines(),
    });
  }
}

function validLines(lines: readonly OperationLineInput[]): boolean {
  const ids = lines.map(({ productId }) => productId);
  return (
    Boolean(lines.length) &&
    ids.every(Boolean) &&
    new Set(ids).size === ids.length &&
    lines.every(({ quantity }) =>
      /^(?:[1-9]\d{0,8}(?:\.\d{1,3})?|0\.(?:00[1-9]|0[1-9]\d?|[1-9]\d{0,2}))$/.test(quantity),
    )
  );
}

function localDate(value: string): string {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
