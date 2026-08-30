import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { finalize, forkJoin, Observable } from 'rxjs';
import {
  WhatsappApiService,
  WhatsappConsentData,
  WhatsappMessageData,
  WhatsappTemplateKey,
} from './whatsapp-api.service';

@Component({
  selector: 'app-whatsapp-panel',
  imports: [DatePipe],
  templateUrl: './whatsapp-panel.component.html',
  styleUrl: './whatsapp-panel.component.scss',
})
export class WhatsappPanelComponent implements OnInit {
  private readonly api = inject(WhatsappApiService);

  protected readonly templates = signal<WhatsappTemplateKey[]>([]);
  protected readonly consents = signal<WhatsappConsentData[]>([]);
  protected readonly messages = signal<WhatsappMessageData[]>([]);
  protected readonly template = signal<WhatsappTemplateKey>('WHATSAPP_SALE_RECEIPT');
  protected readonly reference = signal('SALE-100');
  protected readonly scenario = signal<'SUCCESS' | 'REJECT' | 'TIMEOUT' | 'RETRY'>('SUCCESS');
  protected readonly webhookStatus = signal<'SENT' | 'DELIVERED' | 'READ' | 'FAILED'>('DELIVERED');
  protected readonly webhookAccess = signal<{ messageId: string; token: string } | null>(null);
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
    forkJoin({
      contract: this.api.contract(),
      consents: this.api.consents(),
      messages: this.api.messages(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ contract, consents, messages }) => {
          this.templates.set(contract.data.templates);
          this.consents.set(consents.data);
          this.messages.set(messages.data);
        },
        error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
      });
  }

  protected consent(customer: WhatsappConsentData, enabled: boolean): void {
    this.run(this.api.setConsent(customer.customerId, enabled), ({ data }) => {
      this.consents.update((current) =>
        current.map((item) => (item.customerId === data.customerId ? data : item)),
      );
      this.success.set(
        enabled ? 'Consentimiento WhatsApp registrado.' : 'Baja aplicada de inmediato.',
      );
    });
  }

  protected send(customer: WhatsappConsentData): void {
    if (customer.status !== 'OPTED_IN') return;
    this.run(
      this.api.send(customer.customerId, {
        templateKey: this.template(),
        reference: this.reference().trim() || undefined,
        scenario: this.scenario(),
      }),
      ({ data, meta }) => {
        this.upsert(data);
        if (meta.simulatorWebhookToken) {
          this.webhookAccess.set({ messageId: data.id, token: meta.simulatorWebhookToken });
        }
        this.success.set(`Mensaje procesado con estado ${data.status}.`);
      },
    );
  }

  protected webhook(message: WhatsappMessageData): void {
    const access = this.webhookAccess();
    if (!access || access.messageId !== message.id || !message.providerReference) return;
    this.run(
      this.api.webhook({
        token: access.token,
        providerEventId: `wa-event-${crypto.randomUUID()}`,
        providerReference: message.providerReference,
        status: this.webhookStatus(),
        occurredAt: new Date().toISOString(),
      }),
      ({ data, meta }) => {
        this.upsert(data);
        this.success.set(
          meta.idempotentReplay
            ? 'Webhook verificado y deduplicado.'
            : meta.ignoredOutOfOrder
              ? 'Webhook verificado e ignorado por orden.'
              : 'Webhook verificado y aplicado.',
        );
      },
    );
  }

  protected canWebhook(message: WhatsappMessageData): boolean {
    return (
      !!message.providerReference &&
      this.webhookAccess()?.messageId === message.id &&
      ['SENT', 'DELIVERED'].includes(message.status)
    );
  }

  private run<T>(request: Observable<T>, next: (value: T) => void): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.success.set(null);
    request.pipe(finalize(() => this.busy.set(false))).subscribe({
      next,
      error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
    });
  }

  private upsert(message: WhatsappMessageData): void {
    this.messages.update((current) => [message, ...current.filter(({ id }) => id !== message.id)]);
  }

  private message(error: HttpErrorResponse): string {
    const code = (error.error as { code?: string } | null)?.code;
    if (code === 'WHATSAPP_CONSENT_REQUIRED') return 'El cliente no autorizó WhatsApp.';
    if (code === 'WHATSAPP_PHONE_REQUIRED') return 'El cliente necesita un teléfono registrado.';
    if (code === 'WHATSAPP_RATE_LIMITED') return 'Se alcanzó el límite horario para este cliente.';
    if (code === 'WHATSAPP_WEBHOOK_SIGNATURE_INVALID') return 'Token de webhook inválido.';
    if (error.status === 403) return 'No tienes permiso para administrar WhatsApp.';
    if (error.status === 0) return 'No fue posible conectar con la API de WhatsApp.';
    return 'No fue posible completar la operación de WhatsApp.';
  }
}
