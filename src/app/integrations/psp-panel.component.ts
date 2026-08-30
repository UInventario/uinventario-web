import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { finalize, forkJoin, Observable } from 'rxjs';
import { PspApiService, PspContractData, PspPaymentData } from './psp-api.service';

@Component({
  selector: 'app-psp-panel',
  imports: [DatePipe],
  templateUrl: './psp-panel.component.html',
  styleUrl: './psp-panel.component.scss',
})
export class PspPanelComponent implements OnInit {
  private readonly api = inject(PspApiService);

  protected readonly contract = signal<PspContractData | null>(null);
  protected readonly payments = signal<PspPaymentData[]>([]);
  protected readonly amount = signal('100.00');
  protected readonly currency = signal('MXN');
  protected readonly merchantReference = signal(`WEB-${crypto.randomUUID()}`);
  protected readonly scenario = signal<'SUCCESS' | 'DECLINE' | 'TIMEOUT'>('SUCCESS');
  protected readonly refundAmount = signal('10.00');
  protected readonly webhookStatus = signal<'AUTHORIZED' | 'CAPTURED' | 'DECLINED'>('CAPTURED');
  protected readonly webhookAccess = signal<{ paymentId: string; token: string } | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ contract: this.api.contract(), payments: this.api.list() })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ contract, payments }) => {
          this.contract.set(contract.data);
          this.payments.set(payments.data);
        },
        error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
      });
  }

  protected create(): void {
    if (this.busy()) return;
    this.run(
      this.api.create({
        amount: this.amount(),
        currency: this.currency(),
        merchantReference: this.merchantReference(),
        scenario: this.scenario(),
      }),
      ({ data, meta }) => {
        this.upsert(data);
        if (meta.simulatorWebhookToken) {
          this.webhookAccess.set({ paymentId: data.id, token: meta.simulatorWebhookToken });
        }
        this.merchantReference.set(`WEB-${crypto.randomUUID()}`);
        this.success.set('Intención PSP creada sin capturar datos de tarjeta.');
      },
    );
  }

  protected action(payment: PspPaymentData, action: 'confirm' | 'capture' | 'query'): void {
    if (this.busy()) return;
    this.run(this.api.action(payment.id, action), ({ data }) => {
      this.upsert(data);
      this.success.set(`Operación ${action} completada con estado ${data.status}.`);
    });
  }

  protected refund(payment: PspPaymentData): void {
    if (this.busy()) return;
    this.run(this.api.refund(payment.id, this.refundAmount()), ({ data }) => {
      this.upsert(data);
      this.success.set(`Reembolso acumulado: ${data.refundedAmount} ${data.currency}.`);
    });
  }

  protected webhook(payment: PspPaymentData): void {
    const access = this.webhookAccess();
    if (!access || access.paymentId !== payment.id || this.busy()) return;
    this.run(
      this.api.webhook({
        token: access.token,
        eventId: `evt-${crypto.randomUUID()}`,
        providerReference: payment.providerReference,
        status: this.webhookStatus(),
        occurredAt: new Date().toISOString(),
      }),
      ({ data, meta }) => {
        this.upsert(data);
        this.success.set(
          meta.ignoredOutOfOrder
            ? 'Webhook verificado e ignorado por estar fuera de orden.'
            : 'Webhook verificado y aplicado.',
        );
      },
    );
  }

  protected canRefund(payment: PspPaymentData): boolean {
    return ['CAPTURED', 'PARTIALLY_REFUNDED'].includes(payment.status);
  }

  private run<T>(request: Observable<T>, next: (value: T) => void): void {
    this.busy.set(true);
    this.error.set(null);
    this.success.set(null);
    request.pipe(finalize(() => this.busy.set(false))).subscribe({
      next,
      error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
    });
  }

  private upsert(payment: PspPaymentData): void {
    this.payments.update((current) => [payment, ...current.filter(({ id }) => id !== payment.id)]);
  }

  private message(error: HttpErrorResponse): string {
    const code = (error.error as { code?: string } | null)?.code;
    if (code === 'PSP_RECONCILIATION_REQUIRED') {
      return 'La captura es indeterminada: consulta/reconcilia antes de reintentar.';
    }
    if (code === 'PSP_WEBHOOK_SIGNATURE_INVALID') return 'Token de webhook inválido.';
    if (error.status === 403) return 'No tienes permiso para administrar PSP.';
    if (error.status === 0) return 'No fue posible conectar con la API PSP.';
    return 'No fue posible completar la operación PSP.';
  }
}
