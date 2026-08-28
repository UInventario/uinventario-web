import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import {
  PosApiService,
  PosPeripheralProfileData,
  SaleReceiptData,
  SaleReceiptDeliveryData,
} from './pos-api.service';

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
  readonly canConfigure = input(false);
  readonly canOpenDrawer = input(false);

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
  private pendingPrint: { saleId: string; key: string } | null = null;
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
          this.launchBrowserPrint();
          this.peripheralMessage.set(`Trabajo enviado a ${data.operation.deviceId}.`);
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
        next: ({ data }) =>
          this.peripheralMessage.set(
            data.status === 'COMPLETED'
              ? `Pulso de cajon enviado a ${data.deviceId}.`
              : 'El cajon no respondio. Aplica el procedimiento manual; no se modifico la venta.',
          ),
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
}
