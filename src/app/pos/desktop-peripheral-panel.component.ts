import { Component, effect, inject, input, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  DesktopPeripheralConfig,
  DesktopPeripheralContext,
  DesktopPeripheralService,
} from './desktop-peripheral.service';
import { PosApiService } from './pos-api.service';

@Component({
  selector: 'app-desktop-peripheral-panel',
  imports: [ReactiveFormsModule],
  templateUrl: './desktop-peripheral-panel.component.html',
  styleUrl: './desktop-peripheral-panel.component.scss',
})
export class DesktopPeripheralPanelComponent implements OnInit {
  protected readonly desktop = inject(DesktopPeripheralService);
  private readonly pos = inject(PosApiService);
  private readonly formBuilder = inject(FormBuilder);

  readonly tenantId = input.required<string>();
  readonly cashRegisterId = input.required<string>();
  readonly canConfigure = input(false);
  readonly canOpenDrawer = input(false);
  readonly canPrint = input(false);
  readonly display = input({
    currency: '',
    total: '0.00',
    message: 'Bienvenido',
    lines: [] as Array<{ name: string; quantity: string; total: string }>,
  });

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly diagnosing = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly printers = signal<
    Array<{ name: string; displayName: string; status: number; isDefault: boolean }>
  >([]);
  private readonly context = signal<DesktopPeripheralContext | null>(null);

  protected readonly form = this.formBuilder.nonNullable.group({
    printerAdapter: ['SIMULATOR', Validators.required],
    printerName: [''],
    displayAdapter: ['SIMULATOR', Validators.required],
    simulateDisconnected: [false],
    scanSample: [
      '7500000000001',
      [Validators.required, Validators.minLength(3), Validators.maxLength(120)],
    ],
  });

  constructor() {
    effect(() => {
      const context = this.context();
      const display = this.display();
      if (this.desktop.available() && context) {
        void this.desktop.updateDisplay(context, display).catch(() => undefined);
      }
    });
  }

  async ngOnInit(): Promise<void> {
    if (!this.desktop.available()) return;
    this.loading.set(true);
    try {
      const serverProfile = await firstValueFrom(this.pos.getPeripheralProfile());
      if (serverProfile.data.cashRegister.id !== this.cashRegisterId()) {
        throw new Error('CASH_REGISTER_CONTEXT_MISMATCH');
      }
      this.context.set({
        tenantId: this.tenantId(),
        cashRegisterId: this.cashRegisterId(),
        deviceId: serverProfile.data.deviceId,
      });
      const context = this.context();
      if (!context) throw new Error('DESKTOP_CONTEXT_UNAVAILABLE');
      const [profile, printers] = await Promise.all([
        this.desktop.getConfig(context),
        this.desktop.listPrinters(context),
      ]);
      if (profile.status !== 'COMPLETED' || !profile.config) throw new Error('PROFILE_UNAVAILABLE');
      this.applyConfig(profile.config);
      this.printers.set(printers.printers ?? []);
      await this.desktop.updateDisplay(context, this.display());
    } catch {
      this.error.set('No fue posible cargar los periféricos Desktop.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async save(): Promise<void> {
    const context = this.context();
    if (!this.canConfigure() || !context || this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    if (value.printerAdapter === 'SYSTEM' && !value.printerName) {
      this.error.set('Selecciona una impresora del sistema.');
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.message.set(null);
    try {
      const result = await this.desktop.saveConfig(context, {
        scannerAdapter: 'HID_KEYBOARD',
        printerAdapter: value.printerAdapter as DesktopPeripheralConfig['printerAdapter'],
        printerName: value.printerName || null,
        drawerAdapter: 'SIMULATOR',
        displayAdapter: value.displayAdapter as DesktopPeripheralConfig['displayAdapter'],
        simulateDisconnected: value.simulateDisconnected,
      });
      if (result.status !== 'COMPLETED' || !result.config) throw new Error('SAVE_FAILED');
      this.applyConfig(result.config);
      await this.desktop.updateDisplay(context, this.display());
      this.message.set('Configuración Desktop guardada para esta caja y dispositivo.');
    } catch {
      this.error.set('No fue posible guardar la configuración Desktop.');
    } finally {
      this.saving.set(false);
    }
  }

  protected async diagnose(
    capability: 'SCANNER' | 'PRINTER' | 'DRAWER' | 'DISPLAY',
  ): Promise<void> {
    const context = this.context();
    if (!context || this.diagnosing() || !this.allowed(capability)) return;
    this.diagnosing.set(capability);
    this.error.set(null);
    this.message.set(null);
    try {
      const result = await this.desktop.diagnose(
        context,
        capability,
        capability === 'SCANNER' ? this.form.controls.scanSample.value : undefined,
      );
      if (result.status === 'FAILED') {
        this.error.set(
          result.errorCode === 'DEVICE_DISCONNECTED'
            ? 'Desconexión simulada correctamente; ninguna venta fue creada o modificada.'
            : 'El periférico no respondió. Ninguna venta fue creada o modificada.',
        );
        return;
      }
      this.message.set(`Diagnóstico ${capability.toLowerCase()} completado con ${result.adapter}.`);
    } catch {
      this.error.set('No fue posible ejecutar el diagnóstico Desktop.');
    } finally {
      this.diagnosing.set(null);
    }
  }

  protected allowed(capability: 'SCANNER' | 'PRINTER' | 'DRAWER' | 'DISPLAY'): boolean {
    if (capability === 'PRINTER') return this.canPrint() || this.canConfigure();
    if (capability === 'DRAWER') return this.canOpenDrawer();
    return this.canConfigure();
  }

  private applyConfig(config: DesktopPeripheralConfig): void {
    this.form.patchValue({
      printerAdapter: config.printerAdapter,
      printerName: config.printerName ?? '',
      displayAdapter: config.displayAdapter,
      simulateDisconnected: config.simulateDisconnected,
    });
  }
}
