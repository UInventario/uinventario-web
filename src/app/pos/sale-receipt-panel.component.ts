import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { PosApiService, SaleReceiptData, SaleReceiptDeliveryData } from './pos-api.service';

@Component({
  selector: 'app-sale-receipt-panel',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './sale-receipt-panel.component.html',
  styleUrl: './sale-receipt-panel.component.scss',
})
export class SaleReceiptPanelComponent {
  private readonly pos = inject(PosApiService);
  private readonly formBuilder = inject(FormBuilder);

  readonly saleId = input.required<string>();

  protected readonly receipt = signal<SaleReceiptData | null>(null);
  protected readonly loading = signal(false);
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly delivery = signal<SaleReceiptDeliveryData | null>(null);
  protected readonly emailForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
  });

  protected openReceipt(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    this.delivery.set(null);
    this.pos
      .reprintSaleReceipt(this.saleId())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ data }) => this.receipt.set(data),
        error: (error: HttpErrorResponse) => this.error.set(this.messageFor(error)),
      });
  }

  protected printReceipt(): void {
    if (!this.receipt()) return;
    document.body.classList.add('printing-sale-receipt');
    const cleanup = () => document.body.classList.remove('printing-sale-receipt');
    globalThis.addEventListener('afterprint', cleanup, { once: true });
    globalThis.print();
    globalThis.setTimeout(cleanup, 1_000);
  }

  protected sendReceipt(): void {
    if (!this.receipt() || this.emailForm.invalid || this.sending()) {
      this.emailForm.markAllAsTouched();
      return;
    }
    this.sending.set(true);
    this.error.set(null);
    this.delivery.set(null);
    this.pos
      .sendSaleReceipt(this.saleId(), this.emailForm.controls.email.value)
      .pipe(finalize(() => this.sending.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.receipt.set(data.receipt);
          this.delivery.set(data.delivery);
        },
        error: (error: HttpErrorResponse) => this.error.set(this.messageFor(error)),
      });
  }

  protected paymentLabel(method: SaleReceiptData['payments'][number]['method']): string {
    return { CASH: 'Efectivo', CARD: 'Tarjeta', TRANSFER: 'Transferencia', VOUCHER: 'Vale' }[
      method
    ];
  }

  private messageFor(error: HttpErrorResponse): string {
    if (error.status === 403) return 'No tienes permiso para reimprimir comprobantes.';
    if (error.status === 404) return 'El comprobante ya no está disponible en esta sucursal.';
    if (error.status === 0) return 'No fue posible conectar con el servicio de ventas.';
    return 'No fue posible generar o enviar el comprobante.';
  }
}
