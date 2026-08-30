import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { finalize, forkJoin } from 'rxjs';
import {
  ExternalAdapterApiService,
  ExternalAdapterCapability,
  ExternalAdapterCatalogItem,
  ExternalAdapterConfigData,
  ExternalAdapterExecutionData,
  ExternalEmailEventData,
  ExternalAdapterScenario,
} from './external-adapter-api.service';

@Component({
  selector: 'app-external-adapter-panel',
  imports: [DatePipe],
  templateUrl: './external-adapter-panel.component.html',
  styleUrl: './external-adapter-panel.component.scss',
})
export class ExternalAdapterPanelComponent implements OnInit {
  private readonly api = inject(ExternalAdapterApiService);

  protected readonly configurations = signal<ExternalAdapterConfigData[]>([]);
  protected readonly executions = signal<ExternalAdapterExecutionData[]>([]);
  protected readonly emailEvents = signal<ExternalEmailEventData[]>([]);
  protected readonly catalog = signal<ExternalAdapterCatalogItem[]>([]);
  protected readonly scenario = signal<ExternalAdapterScenario>('SUCCESS');
  protected readonly loading = signal(true);
  protected readonly busy = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected capabilityLabel(capability: ExternalAdapterCapability): string {
    return capability === 'NOTIFICATION_EMAIL'
      ? 'Email de notificaciones'
      : capability === 'NOTIFICATION_PUSH'
        ? 'Push de notificaciones'
        : 'WhatsApp de notificaciones';
  }

  protected update(
    capability: ExternalAdapterCapability,
    change: Partial<ExternalAdapterConfigData>,
  ): void {
    this.configurations.update((items) =>
      items.map((item) => (item.capability === capability ? { ...item, ...change } : item)),
    );
  }

  protected providerOptions(capability: ExternalAdapterCapability): ExternalAdapterCatalogItem[] {
    return this.catalog().filter((item) => item.capability === capability);
  }

  protected selectProvider(capability: ExternalAdapterCapability, provider: string): void {
    const selected = this.providerOptions(capability).find((item) => item.provider === provider);
    if (!selected) return;
    this.update(capability, {
      provider: selected.provider,
      adapterVersion: selected.version,
    });
  }

  protected save(configuration: ExternalAdapterConfigData): void {
    if (this.busy()) return;
    this.busy.set(`save:${configuration.capability}`);
    this.clearMessages();
    this.api
      .update(configuration)
      .pipe(finalize(() => this.busy.set(null)))
      .subscribe({
        next: ({ data }) => {
          this.update(data.capability, data);
          this.success.set('Configuración del adaptador guardada.');
        },
        error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
      });
  }

  protected diagnose(capability: ExternalAdapterCapability): void {
    if (this.busy()) return;
    this.busy.set(`diagnose:${capability}`);
    this.clearMessages();
    this.api
      .diagnose(capability, this.scenario())
      .pipe(finalize(() => this.busy.set(null)))
      .subscribe({
        next: ({ data }) => {
          this.success.set(`Diagnóstico ${data.status}; ${data.attemptCount} intento(s).`);
          this.loadExecutions();
        },
        error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
      });
  }

  private load(): void {
    this.loading.set(true);
    forkJoin({
      configurations: this.api.configurations(),
      executions: this.api.executions(),
      emailEvents: this.api.emailEvents(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ configurations, executions, emailEvents }) => {
          this.configurations.set(configurations.data);
          this.catalog.set(configurations.meta.catalog);
          this.executions.set(executions.data);
          this.emailEvents.set(emailEvents.data);
        },
        error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
      });
  }

  private loadExecutions(): void {
    this.api.executions().subscribe({
      next: ({ data }) => this.executions.set(data),
      error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
    });
  }

  private clearMessages(): void {
    this.error.set(null);
    this.success.set(null);
  }

  private message(error: HttpErrorResponse): string {
    if (error.status === 403) return 'No tienes permiso para administrar integraciones.';
    if (error.status === 0) return 'No fue posible conectar con el servicio de integraciones.';
    return 'No fue posible actualizar el adaptador.';
  }
}
