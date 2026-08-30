import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../../core/api/api-error';
import { SalesLifecycleFacade } from '../../application/sales-lifecycle.facade';
import { ReceiptDelivery, SaleReceipt } from '../../domain/sales-lifecycle.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ReactiveFormsModule],
  selector: 'ui-sale-receipt-dialog',
  styleUrl: './receipt-dialog.scss',
  templateUrl: './receipt-dialog.html',
})
export class ReceiptDialog {
  private readonly facade = inject(SalesLifecycleFacade);
  private readonly formBuilder = inject(FormBuilder);

  readonly receipt = input.required<SaleReceipt>();
  readonly closed = output<void>();

  protected readonly emailForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
  });
  protected readonly sending = signal(false);
  protected readonly delivery = signal<ReceiptDelivery | null>(null);
  protected readonly error = signal<string | null>(null);

  protected money(value: string): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: this.receipt().currency,
    }).format(Number(value));
  }

  protected send(): void {
    if (this.emailForm.invalid || this.sending()) return;
    this.sending.set(true);
    this.error.set(null);
    this.delivery.set(null);
    this.facade
      .sendReceipt(this.receipt().saleId, this.emailForm.controls.email.value.trim())
      .pipe(finalize(() => this.sending.set(false)))
      .subscribe({
        next: (delivery) => this.delivery.set(delivery),
        error: (error: unknown) =>
          this.error.set(
            error instanceof ApiError ? error.message : 'No fue posible enviar el ticket.',
          ),
      });
  }

  protected print(): void {
    const receipt = this.receipt();
    const popup = window.open('', 'uinventario-receipt', 'width=440,height=720');
    if (!popup) {
      this.error.set('El navegador bloqueó la ventana de impresión. Habilita ventanas emergentes.');
      return;
    }
    const rows = receipt.lines
      .map(
        (line) =>
          `<tr><td>${this.escape(line.quantity)} × ${this.escape(line.productName)}<small>${this.escape(line.productSku)}</small></td><td>${this.escape(this.money(line.total))}</td></tr>`,
      )
      .join('');
    const payments = receipt.payments
      .map(
        (payment) =>
          `<div><span>${this.escape(payment.method)}</span><strong>${this.escape(this.money(payment.amountApplied))}</strong></div>`,
      )
      .join('');
    popup.document.open();
    popup.document.write(
      `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${this.escape(receipt.receiptNumber)}</title><style>body{color:#111;font-family:ui-monospace,monospace;margin:0 auto;padding:24px;width:320px}header{text-align:center}h1{font-size:20px;margin:6px 0}p{margin:3px 0}table{border-collapse:collapse;margin:18px 0;width:100%}td{border-bottom:1px dashed #aaa;padding:8px 0}td:last-child{text-align:right}small{display:block;color:#555}.totals,.payments{display:grid;gap:6px}.totals div,.payments div{display:flex;justify-content:space-between}.total{border-top:2px solid #111;font-size:18px;padding-top:8px}.notice{border:1px solid #111;margin-top:18px;padding:8px;text-align:center}@media print{body{padding:0}}</style></head><body><header><strong>${this.escape(receipt.merchant.name)}</strong><h1>${this.escape(receipt.receiptNumber)}</h1><p>${this.escape(receipt.branchName)} · ${this.escape(receipt.cashRegister.name)}</p><p>${this.escape(new Date(receipt.issuedAt).toLocaleString('es-MX'))}</p></header><table>${rows}</table><section class="totals"><div><span>Subtotal</span><strong>${this.escape(this.money(receipt.totals.subtotal))}</strong></div><div><span>Impuestos</span><strong>${this.escape(this.money(receipt.totals.tax))}</strong></div><div class="total"><span>Total</span><strong>${this.escape(this.money(receipt.totals.total))}</strong></div></section><h2>Pagos</h2><section class="payments">${payments}</section><p class="notice">${this.escape(receipt.fiscalNotice)}</p></body></html>`,
    );
    popup.document.close();
    popup.focus();
    popup.print();
  }

  private escape(value: string): string {
    return value.replace(/[&<>'"]/g, (character) => {
      const entities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      };
      return entities[character] ?? character;
    });
  }
}
