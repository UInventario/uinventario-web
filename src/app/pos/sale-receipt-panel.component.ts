import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, Observable } from 'rxjs';
import {
  PosApiService,
  PosPeripheralProfileData,
  SaleFiscalDocumentData,
  SaleFiscalDeliveryData,
  SaleReceiptData,
  SaleReceiptDeliveryData,
} from './pos-api.service';
import { DesktopPeripheralContext, DesktopPeripheralService } from './desktop-peripheral.service';

@Component({
  selector: 'app-sale-receipt-panel',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './sale-receipt-panel.component.html',
  styleUrl: './sale-receipt-panel.component.scss',
})
export class SaleReceiptPanelComponent {
  private readonly pos = inject(PosApiService);
  private readonly desktop = inject(DesktopPeripheralService);
  private readonly formBuilder = inject(FormBuilder);

  readonly saleId = input.required<string>();
  readonly canConfigure = input(false);
  readonly canOpenDrawer = input(false);
  readonly tenantId = input<string | null>(null);

  protected readonly receipt = signal<SaleReceiptData | null>(null);
  protected readonly loading = signal(false);
  protected readonly sending = signal(false);
  protected readonly printing = signal(false);
  protected readonly openingDrawer = signal(false);
  protected readonly savingProfile = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly peripheralMessage = signal<string | null>(null);
  protected readonly profile = signal<PosPeripheralProfileData | null>(null);
  protected readonly delivery = signal<SaleReceiptDeliveryData | null>(null);
  protected readonly fiscalDocument = signal<SaleFiscalDocumentData | null>(null);
  protected readonly fiscalDelivery = signal<SaleFiscalDeliveryData | null>(null);
  protected readonly fiscalScenario = signal<SaleFiscalDocumentData['scenario']>('SUCCESS');
  protected readonly fiscalDocumentType = signal<SaleFiscalDocumentData['documentType']>('INVOICE');
  protected readonly fiscalBusy = signal(false);
  protected readonly fiscalMessage = signal<string | null>(null);
  private pendingPrint: { saleId: string; key: string } | null = null;
  private pendingFiscalEmail: { saleId: string; email: string; key: string } | null = null;
  protected readonly emailForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
  });
  protected readonly profileForm = this.formBuilder.nonNullable.group({
    deviceId: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(80)]],
    label: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    printerEnabled: [true],
    drawerEnabled: [true],
    autoOpenCashSale: [true],
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
        next: ({ data }) => {
          this.receipt.set(data);
          this.loadProfile();
          this.loadFiscalDocument();
        },
        error: (error: HttpErrorResponse) => this.error.set(this.messageFor(error)),
      });
  }

  protected printReceipt(): void {
    if (!this.receipt() || this.printing()) return;
    const saleId = this.saleId();
    const key =
      this.pendingPrint?.saleId === saleId
        ? this.pendingPrint.key
        : `web-receipt-print-${globalThis.crypto.randomUUID()}`;
    this.pendingPrint = { saleId, key };
    this.printing.set(true);
    this.error.set(null);
    this.peripheralMessage.set(null);
    this.pos
      .printSaleReceipt(saleId, key)
      .pipe(finalize(() => this.printing.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.pendingPrint = null;
          this.receipt.set(data.receipt);
          if (data.operation.status === 'FAILED') {
            this.peripheralMessage.set(
              'La impresora no respondio. Usa la impresion manual o reintenta; la venta no se duplico.',
            );
            return;
          }
          void this.printOnDesktop(data.operation.id, data.receipt);
        },
        error: (error: HttpErrorResponse) => {
          if (error.status > 0) this.pendingPrint = null;
          this.error.set(this.peripheralMessageFor(error));
        },
      });
  }

  protected printManually(): void {
    if (this.receipt()) this.launchBrowserPrint();
  }

  protected openDrawer(): void {
    if (this.openingDrawer()) return;
    this.openingDrawer.set(true);
    this.error.set(null);
    this.peripheralMessage.set(null);
    this.pos
      .openCashDrawer({ trigger: 'MANUAL' }, `web-drawer-manual-${globalThis.crypto.randomUUID()}`)
      .pipe(finalize(() => this.openingDrawer.set(false)))
      .subscribe({
        next: ({ data }) => {
          if (data.status !== 'COMPLETED') {
            this.peripheralMessage.set(
              'El cajon no respondio. Aplica el procedimiento manual; no se modifico la venta.',
            );
            return;
          }
          void this.openDesktopDrawer(data.id, data.deviceId);
        },
        error: (error: HttpErrorResponse) => this.error.set(this.peripheralMessageFor(error)),
      });
  }

  protected saveProfile(): void {
    if (!this.canConfigure() || this.profileForm.invalid || this.savingProfile()) {
      this.profileForm.markAllAsTouched();
      return;
    }
    this.savingProfile.set(true);
    this.error.set(null);
    const value = this.profileForm.getRawValue();
    this.pos
      .updatePeripheralProfile({ ...value, adapter: 'SIMULATOR' })
      .pipe(finalize(() => this.savingProfile.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.setProfile(data);
          this.peripheralMessage.set('Configuracion del dispositivo guardada para esta caja.');
        },
        error: (error: HttpErrorResponse) => this.error.set(this.peripheralMessageFor(error)),
      });
  }

  private launchBrowserPrint(): void {
    document.body.classList.add('printing-sale-receipt');
    const cleanup = () => document.body.classList.remove('printing-sale-receipt');
    globalThis.addEventListener('afterprint', cleanup, { once: true });
    globalThis.print();
    globalThis.setTimeout(cleanup, 1_000);
  }

  private loadProfile(): void {
    this.pos.getPeripheralProfile().subscribe({
      next: ({ data }) => this.setProfile(data),
      error: (error: HttpErrorResponse) => this.error.set(this.peripheralMessageFor(error)),
    });
  }

  private setProfile(data: PosPeripheralProfileData): void {
    this.profile.set(data);
    this.profileForm.reset({
      deviceId: data.deviceId,
      label: data.label,
      printerEnabled: data.printerEnabled,
      drawerEnabled: data.drawerEnabled,
      autoOpenCashSale: data.autoOpenCashSale,
    });
  }

  private async printOnDesktop(operationId: string, receipt: SaleReceiptData): Promise<void> {
    const context = this.desktopContext();
    if (!this.desktop.available() || !context) {
      this.launchBrowserPrint();
      this.peripheralMessage.set(
        `Trabajo enviado a ${context?.deviceId ?? 'la impresora del navegador'}.`,
      );
      return;
    }
    try {
      const result = await this.desktop.printReceipt(context, operationId, {
        receiptNumber: receipt.receiptNumber,
        merchantName: receipt.merchant.name,
        currency: receipt.currency,
        total: receipt.totals.total,
        lines: receipt.lines.map((line) => ({
          name: line.productName,
          quantity: line.quantity,
          total: line.total,
        })),
      });
      if (result.status === 'FAILED') {
        this.peripheralMessage.set(
          'La impresora Desktop no respondio. Usa la impresion manual; la venta permanece registrada.',
        );
        return;
      }
      if (result.adapter === 'SIMULATOR') this.launchBrowserPrint();
      this.peripheralMessage.set(
        result.replayed
          ? 'La operacion de impresion ya habia sido procesada; no se duplico.'
          : `Trabajo Desktop completado con ${result.adapter}.`,
      );
    } catch {
      this.peripheralMessage.set(
        'No fue posible operar la impresora Desktop. La venta permanece registrada.',
      );
    }
  }

  private async openDesktopDrawer(operationId: string, deviceId: string): Promise<void> {
    const context = this.desktopContext();
    if (!this.desktop.available() || !context) {
      this.peripheralMessage.set(`Pulso de cajon enviado a ${deviceId}.`);
      return;
    }
    try {
      const result = await this.desktop.openDrawer(context, operationId, 'MANUAL');
      this.peripheralMessage.set(
        result.status === 'COMPLETED'
          ? result.replayed
            ? 'La apertura ya habia sido procesada; no se repitio.'
            : `Cajon Desktop operado con ${result.adapter}.`
          : 'El cajon Desktop no respondio. La venta permanece registrada.',
      );
    } catch {
      this.peripheralMessage.set('El puente Desktop no respondio. La venta permanece registrada.');
    }
  }

  private desktopContext(): DesktopPeripheralContext | null {
    const tenantId = this.tenantId();
    const profile = this.profile();
    if (!tenantId || !profile) return null;
    return {
      tenantId,
      cashRegisterId: profile.cashRegister.id,
      deviceId: profile.deviceId,
    };
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

  protected issueFiscalDocument(): void {
    this.runFiscal(
      this.pos.issueSaleFiscalDocument(this.saleId(), {
        documentType: this.fiscalDocumentType(),
        scenario: this.fiscalScenario(),
      }),
      'Documento fiscal procesado sin repetir la venta.',
    );
  }

  protected retryFiscalDocument(): void {
    const document = this.fiscalDocument();
    if (!document || document.status !== 'PENDING') return;
    this.runFiscal(
      this.pos.issueSaleFiscalDocument(this.saleId(), {
        documentType: document.documentType,
        scenario: document.scenario,
      }),
      'EmisiÃ³n fiscal reintentada con la misma identidad.',
    );
  }

  protected queryFiscalDocument(): void {
    this.runFiscal(
      this.pos.querySaleFiscalDocument(this.saleId()),
      'Estado fiscal actualizado de forma segura.',
    );
  }

  protected cancelFiscalDocument(): void {
    this.runFiscal(this.pos.cancelSaleFiscalDocument(this.saleId()), 'Documento fiscal cancelado.');
  }

  protected resolveFiscalCallback(status: 'ACCEPTED' | 'REJECTED'): void {
    this.runFiscal(
      this.pos.callbackSaleFiscalDocument(this.saleId(), status),
      'Callback fiscal procesado.',
    );
  }

  protected sendFiscalDocument(): void {
    if (this.emailForm.invalid || this.fiscalBusy()) {
      this.emailForm.markAllAsTouched();
      return;
    }
    this.fiscalBusy.set(true);
    this.error.set(null);
    this.fiscalDelivery.set(null);
    const saleId = this.saleId();
    const email = this.emailForm.controls.email.value;
    const key =
      this.pendingFiscalEmail?.saleId === saleId && this.pendingFiscalEmail.email === email
        ? this.pendingFiscalEmail.key
        : `web-sale-fiscal-email-${globalThis.crypto.randomUUID()}`;
    this.pendingFiscalEmail = { saleId, email, key };
    this.pos
      .sendSaleFiscalDocument(saleId, email, key)
      .pipe(finalize(() => this.fiscalBusy.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.pendingFiscalEmail = null;
          this.fiscalDocument.set(data.document);
          this.fiscalDelivery.set(data.delivery);
          this.fiscalMessage.set('Documento fiscal aceptado para entrega digital.');
        },
        error: (error: HttpErrorResponse) => this.error.set(this.fiscalMessageFor(error)),
      });
  }

  protected downloadFiscalArtifact(kind: 'PDF' | 'XML', print = false): void {
    if (this.fiscalBusy()) return;
    this.fiscalBusy.set(true);
    this.error.set(null);
    this.pos
      .saleFiscalArtifact(this.saleId(), kind)
      .pipe(finalize(() => this.fiscalBusy.set(false)))
      .subscribe({
        next: ({ data }) => {
          const bytes = Uint8Array.from(atob(data.contentBase64), (character) =>
            character.charCodeAt(0),
          );
          const url = URL.createObjectURL(new Blob([bytes], { type: data.mediaType }));
          if (print) {
            globalThis.open(url, '_blank', 'noopener');
          } else {
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = data.fileName;
            anchor.click();
          }
          globalThis.setTimeout(() => URL.revokeObjectURL(url), 1_000);
          this.fiscalMessage.set(
            print ? 'PDF fiscal abierto para impresiÃ³n.' : `${kind} fiscal descargado.`,
          );
        },
        error: (error: HttpErrorResponse) => this.error.set(this.fiscalMessageFor(error)),
      });
  }

  protected paymentLabel(method: SaleReceiptData['payments'][number]['method']): string {
    return {
      CASH: 'Efectivo',
      CARD: 'Tarjeta',
      TRANSFER: 'Transferencia',
      VOUCHER: 'Vale / puntos',
      CREDIT: 'Crédito',
    }[method];
  }

  private messageFor(error: HttpErrorResponse): string {
    if (error.status === 403) return 'No tienes permiso para reimprimir comprobantes.';
    if (error.status === 404) return 'El comprobante ya no está disponible en esta sucursal.';
    if (error.status === 0) return 'No fue posible conectar con el servicio de ventas.';
    return 'No fue posible generar o enviar el comprobante.';
  }

  private peripheralMessageFor(error: HttpErrorResponse): string {
    const code = (error.error as { code?: string } | null)?.code;
    if (error.status === 403) return 'No tienes permiso para operar este periferico.';
    if (code === 'CASH_REGISTER_SHIFT_REQUIRED') return 'Abre el turno antes de operar el cajon.';
    if (code === 'PERIPHERAL_CAPABILITY_DISABLED')
      return 'La funcion esta desactivada para esta caja. Usa el procedimiento manual.';
    if (error.status === 0)
      return 'El servicio no respondio. La venta permanece registrada; puedes reintentar el periferico.';
    return 'No fue posible operar el dispositivo. Usa el procedimiento manual.';
  }

  private loadFiscalDocument(): void {
    this.pos.getSaleFiscalDocument(this.saleId()).subscribe({
      next: ({ data }) => this.fiscalDocument.set(data),
      error: (error: HttpErrorResponse) => this.error.set(this.fiscalMessageFor(error)),
    });
  }

  private runFiscal(request: Observable<{ data: SaleFiscalDocumentData }>, message: string): void {
    if (this.fiscalBusy()) return;
    this.fiscalBusy.set(true);
    this.error.set(null);
    this.fiscalMessage.set(null);
    request.pipe(finalize(() => this.fiscalBusy.set(false))).subscribe({
      next: ({ data }) => {
        this.fiscalDocument.set(data);
        this.fiscalMessage.set(message);
      },
      error: (error: HttpErrorResponse) => this.error.set(this.fiscalMessageFor(error)),
    });
  }

  private fiscalMessageFor(error: HttpErrorResponse): string {
    if (error.status === 403) return 'No tienes permiso para operar documentos fiscales.';
    if (error.status === 404) return 'La venta o el documento fiscal no estÃ¡ disponible.';
    if (error.status === 400) {
      return 'El contrato fiscal no estÃ¡ listo o el estado no permite esta operaciÃ³n.';
    }
    if (error.status === 0) {
      return 'Fiscalidad no respondiÃ³. La venta permanece completada; consulta antes de reemitir.';
    }
    return 'No fue posible operar el documento fiscal. La venta no fue modificada.';
  }
}
