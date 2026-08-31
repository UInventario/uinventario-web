import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  DesktopDiagnostic,
  DesktopPeripheralConfig,
  DesktopPeripheralContext,
  DesktopPrinter,
} from '../../../../../core/desktop/desktop-peripheral.models';
import { DesktopPeripheralPort } from '../../../../../core/desktop/desktop-peripheral.port';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  selector: 'ui-pos-peripheral-dialog',
  styleUrl: './pos-peripheral-dialog.scss',
  templateUrl: './pos-peripheral-dialog.html',
})
export class PosPeripheralDialog implements OnInit {
  private readonly desktop = inject(DesktopPeripheralPort);

  readonly context = input.required<DesktopPeripheralContext>();
  readonly canConfigure = input(false);
  readonly canPrint = input(false);
  readonly canOpenDrawer = input(false);
  readonly closed = output<void>();

  protected readonly form = new FormBuilder().nonNullable.group({
    printerAdapter: ['SIMULATOR' as DesktopPeripheralConfig['printerAdapter']],
    printerName: [''],
    displayAdapter: ['SIMULATOR' as DesktopPeripheralConfig['displayAdapter']],
    simulateDisconnected: [false],
    scanSample: ['7500000000001'],
  });
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly diagnosing = signal<DesktopDiagnostic | null>(null);
  protected readonly printers = signal<readonly DesktopPrinter[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  protected allowed(capability: DesktopDiagnostic): boolean {
    if (capability === 'PRINTER') return this.canPrint() || this.canConfigure();
    if (capability === 'DRAWER') return this.canOpenDrawer();
    return this.canConfigure();
  }

  protected async diagnose(capability: DesktopDiagnostic): Promise<void> {
    if (!this.allowed(capability) || this.diagnosing()) return;
    this.diagnosing.set(capability);
    this.error.set(null);
    this.notice.set(null);
    try {
      const result = await this.desktop.diagnose(
        this.context(),
        capability,
        capability === 'SCANNER' ? this.form.controls.scanSample.value.trim() : undefined,
      );
      if (result.status === 'FAILED') {
        this.error.set(
          result.errorCode === 'DEVICE_DISCONNECTED'
            ? 'Desconexión simulada correctamente; la venta no fue modificada.'
            : 'El dispositivo no respondió; la venta permanece intacta.',
        );
      } else {
        this.notice.set(`Diagnóstico ${capability.toLocaleLowerCase()} completado.`);
      }
    } catch {
      this.error.set('El bridge Desktop no respondió; la venta permanece intacta.');
    } finally {
      this.diagnosing.set(null);
    }
  }

  protected async save(): Promise<void> {
    if (!this.canConfigure() || this.saving()) return;
    const value = this.form.getRawValue();
    if (value.printerAdapter === 'SYSTEM' && !value.printerName) {
      this.error.set('Selecciona una impresora del sistema.');
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      const result = await this.desktop.saveConfig(this.context(), {
        scannerAdapter: 'HID_KEYBOARD',
        printerAdapter: value.printerAdapter,
        printerName: value.printerName || null,
        drawerAdapter: 'SIMULATOR',
        displayAdapter: value.displayAdapter,
        simulateDisconnected: value.simulateDisconnected,
      });
      if (result.status !== 'COMPLETED' || !result.config) throw new Error('SAVE_FAILED');
      this.apply(result.config);
      this.notice.set('Configuración guardada para esta caja y dispositivo.');
    } catch {
      this.error.set('No fue posible guardar la configuración Desktop.');
    } finally {
      this.saving.set(false);
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [config, printers] = await Promise.all([
        this.desktop.getConfig(this.context()),
        this.desktop.listPrinters(this.context()),
      ]);
      if (config.status !== 'COMPLETED' || !config.config) throw new Error('CONFIG_FAILED');
      this.apply(config.config);
      this.printers.set(printers.printers ?? []);
    } catch {
      this.error.set('No fue posible consultar los periféricos Desktop.');
    } finally {
      this.loading.set(false);
    }
  }

  private apply(config: DesktopPeripheralConfig): void {
    this.form.patchValue({
      printerAdapter: config.printerAdapter,
      printerName: config.printerName ?? '',
      displayAdapter: config.displayAdapter,
      simulateDisconnected: config.simulateDisconnected,
    });
  }
}
