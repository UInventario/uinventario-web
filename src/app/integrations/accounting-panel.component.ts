import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { finalize, forkJoin, Observable } from 'rxjs';
import {
  AccountingApiService,
  AccountingConfigData,
  AccountingEventData,
} from './accounting-api.service';

type AccountConfig = Omit<AccountingConfigData, 'provider' | 'contractVersion' | 'updatedAt'>;

@Component({
  selector: 'app-accounting-panel',
  imports: [DatePipe],
  templateUrl: './accounting-panel.component.html',
  styleUrl: './accounting-panel.component.scss',
})
export class AccountingPanelComponent implements OnInit {
  private readonly api = inject(AccountingApiService);

  protected readonly sources = signal<string[]>([]);
  protected readonly events = signal<AccountingEventData[]>([]);
  protected readonly accounts = signal<AccountConfig>({
    paymentClearingAccount: '1100-CLEARING',
    salesRevenueAccount: '4100-SALES',
    salesReturnsAccount: '4110-RETURNS',
    taxPayableAccount: '2100-TAX',
    inventoryAssetAccount: '1200-INVENTORY',
    costOfGoodsSoldAccount: '5100-COGS',
    cashAccount: '1000-CASH',
    cashClearingAccount: '2190-CASH-CLEARING',
  });
  protected readonly scenario = signal<'SUCCESS' | 'REJECT' | 'TIMEOUT'>('SUCCESS');
  protected readonly configured = signal(false);
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
      config: this.api.configData(),
      events: this.api.events(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ contract, config, events }) => {
          this.sources.set(contract.data.sources);
          this.events.set(events.data);
          if (config.data) {
            this.accounts.set({
              paymentClearingAccount: config.data.paymentClearingAccount,
              salesRevenueAccount: config.data.salesRevenueAccount,
              salesReturnsAccount: config.data.salesReturnsAccount,
              taxPayableAccount: config.data.taxPayableAccount,
              inventoryAssetAccount: config.data.inventoryAssetAccount,
              costOfGoodsSoldAccount: config.data.costOfGoodsSoldAccount,
              cashAccount: config.data.cashAccount,
              cashClearingAccount: config.data.cashClearingAccount,
            });
            this.configured.set(true);
          }
        },
        error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
      });
  }

  protected account(key: keyof AccountConfig, value: string): void {
    this.accounts.update((current) => ({ ...current, [key]: value }));
  }

  protected saveConfig(): void {
    this.run(this.api.saveConfig(this.accounts()), ({ data }) => {
      this.configured.set(true);
      this.success.set(`Configuración contable ${data.contractVersion} guardada.`);
    });
  }

  protected generate(): void {
    this.run(this.api.generate(), ({ data, meta }) => {
      this.events.update((current) => [
        ...data,
        ...current.filter((event) => !data.some(({ id }) => id === event.id)),
      ]);
      this.success.set(`${meta.created} candidato(s) nuevo(s) de ${meta.discovered} fuente(s).`);
    });
  }

  protected deliver(event: AccountingEventData): void {
    this.run(this.api.deliver(event.id, this.scenario()), ({ data }) => {
      this.upsert(data);
      this.success.set(`Entrega simulada: ${data.status}.`);
    });
  }

  protected reconcile(event: AccountingEventData): void {
    this.run(this.api.reconcile(event.id), ({ data }) => {
      this.upsert(data);
      this.success.set(`Conciliación: ${data.status}.`);
    });
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

  private upsert(event: AccountingEventData): void {
    this.events.update((current) => [event, ...current.filter(({ id }) => id !== event.id)]);
  }

  private message(error: HttpErrorResponse): string {
    const code = (error.error as { code?: string } | null)?.code;
    if (code === 'ACCOUNTING_RECONCILIATION_REQUIRED') {
      return 'La entrega es indeterminada: concilia antes de reintentar.';
    }
    if (code === 'ACCOUNTING_CONFIG_REQUIRED') return 'Guarda primero las cuentas externas.';
    if (error.status === 403) return 'No tienes permiso para administrar contabilidad.';
    if (error.status === 0) return 'No fue posible conectar con la API contable.';
    return 'No fue posible completar la operación contable.';
  }
}
