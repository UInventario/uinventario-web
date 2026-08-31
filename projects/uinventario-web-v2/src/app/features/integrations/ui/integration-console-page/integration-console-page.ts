import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { IntegrationFacade } from '../../application/integration.facade';
import {
  AdapterCapability,
  AdapterCatalogItem,
  AdapterConfiguration,
  AdapterExecution,
  AdapterScenario,
  EmailEvent,
  ProviderSummary,
} from '../../domain/integration.models';

type ConsolePanel = 'overview' | 'adapters' | 'activity';

interface AdapterDraft {
  readonly countryCode: string;
  readonly provider: string;
  readonly adapterVersion: string;
  readonly enabled: boolean;
  readonly timeoutMs: number;
  readonly maxAttempts: number;
  readonly secretReference: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  selector: 'ui-integration-console-page',
  styleUrl: './integration-console-page.scss',
  templateUrl: './integration-console-page.html',
})
export class IntegrationConsolePage implements OnInit {
  private readonly facade = inject(IntegrationFacade);

  protected readonly panel = signal<ConsolePanel>('overview');
  protected readonly loading = signal(true);
  protected readonly acting = signal<AdapterCapability | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly providers = signal<readonly ProviderSummary[]>([]);
  protected readonly providerErrors = signal<readonly { label: string; message: string }[]>([]);
  protected readonly configurations = signal<readonly AdapterConfiguration[]>([]);
  protected readonly catalog = signal<readonly AdapterCatalogItem[]>([]);
  protected readonly executions = signal<readonly AdapterExecution[]>([]);
  protected readonly emailEvents = signal<readonly EmailEvent[]>([]);
  protected readonly sourceErrors = signal<readonly string[]>([]);
  protected readonly drafts = signal<Partial<Record<AdapterCapability, AdapterDraft>>>({});
  protected readonly degradedCount = computed(
    () =>
      this.providerErrors().length +
      this.providers().filter(({ health }) => health === 'DEGRADED').length +
      this.configurations().filter((item) => this.adapterHealth(item.capability) === 'DEGRADED')
        .length,
  );

  protected readonly capabilityLabel = (capability: AdapterCapability) =>
    ({
      NOTIFICATION_EMAIL: 'Correo electrónico',
      NOTIFICATION_PUSH: 'Notificaciones push',
      NOTIFICATION_WHATSAPP: 'WhatsApp operativo',
    })[capability];

  ngOnInit(): void {
    this.load();
  }

  protected selectPanel(panel: ConsolePanel): void {
    this.panel.set(panel);
    this.notice.set(null);
  }

  protected updateDraft(
    capability: AdapterCapability,
    field: keyof AdapterDraft,
    value: string | number | boolean,
  ): void {
    this.drafts.update((drafts) => ({
      ...drafts,
      [capability]: { ...drafts[capability]!, [field]: value },
    }));
  }

  protected save(configuration: AdapterConfiguration): void {
    const draft = this.drafts()[configuration.capability];
    if (!draft || this.acting()) return;
    if (
      !configuration.enabled &&
      draft.enabled &&
      !window.confirm(
        `¿Activar ${this.capabilityLabel(configuration.capability)}? Empezará a procesar eventos reales del tenant.`,
      )
    ) {
      return;
    }
    this.acting.set(configuration.capability);
    this.notice.set(null);
    this.facade
      .updateAdapter({
        capability: configuration.capability,
        countryCode: draft.countryCode,
        provider: draft.provider,
        adapterVersion: draft.adapterVersion,
        enabled: draft.enabled,
        timeoutMs: Number(draft.timeoutMs),
        maxAttempts: Number(draft.maxAttempts),
        secretReference: draft.secretReference || configuration.secretReference,
      })
      .pipe(finalize(() => this.acting.set(null)))
      .subscribe({
        next: (updated) => {
          this.configurations.update((items) =>
            items.map((item) => (item.capability === updated.capability ? updated : item)),
          );
          this.drafts.update((drafts) => ({
            ...drafts,
            [updated.capability]: this.toDraft(updated),
          }));
          this.notice.set(`${this.capabilityLabel(updated.capability)} actualizado.`);
        },
        error: (error: unknown) => this.notice.set(this.message(error)),
      });
  }

  protected diagnose(capability: AdapterCapability, scenario: AdapterScenario): void {
    if (this.acting()) return;
    this.acting.set(capability);
    this.notice.set(null);
    this.facade
      .diagnose(capability, scenario)
      .pipe(finalize(() => this.acting.set(null)))
      .subscribe({
        next: (execution) => {
          this.executions.update((items) => [execution, ...items]);
          this.notice.set(`Diagnóstico ${execution.status.toLowerCase()} registrado.`);
        },
        error: (error: unknown) => this.notice.set(this.message(error)),
      });
  }

  protected adapterMode(configuration: AdapterConfiguration): 'SIMULATOR' | 'LIVE' | 'UNKNOWN' {
    return (
      this.catalogItem(configuration)?.mode ??
      (configuration.provider.toUpperCase().includes('SIMULATOR') ? 'SIMULATOR' : 'UNKNOWN')
    );
  }

  protected adapterHealth(capability: AdapterCapability): 'HEALTHY' | 'DEGRADED' | 'UNKNOWN' {
    const latest = this.executions().find((item) => item.capability === capability);
    if (!latest) return 'UNKNOWN';
    return latest.status === 'SUCCEEDED' ? 'HEALTHY' : 'DEGRADED';
  }

  protected healthLabel(health: ProviderSummary['health']): string {
    return { HEALTHY: 'Saludable', DEGRADED: 'Con atención', UNKNOWN: 'Sin actividad' }[health];
  }

  protected healthIcon(health: ProviderSummary['health']): string {
    return {
      HEALTHY: 'pi pi-check-circle',
      DEGRADED: 'pi pi-exclamation-triangle',
      UNKNOWN: 'pi pi-minus-circle',
    }[health];
  }

  protected providerIcon(key: ProviderSummary['key']): string {
    return {
      fiscal: 'pi pi-receipt',
      erp: 'pi pi-sitemap',
      psp: 'pi pi-credit-card',
      accounting: 'pi pi-calculator',
      whatsapp: 'pi pi-whatsapp',
    }[key];
  }

  protected trackProvider(_: number, provider: ProviderSummary): string {
    return provider.key;
  }

  private load(): void {
    this.loading.set(true);
    this.facade
      .load()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((snapshot) => {
        const configurations = snapshot.adapters.data?.configurations ?? [];
        this.configurations.set(configurations);
        this.catalog.set(snapshot.adapters.data?.catalog ?? []);
        this.drafts.set(
          Object.fromEntries(
            configurations.map((item) => [item.capability, this.toDraft(item)]),
          ) as Partial<Record<AdapterCapability, AdapterDraft>>,
        );
        this.executions.set(snapshot.executions.data ?? []);
        this.emailEvents.set(snapshot.emailEvents.data ?? []);
        this.providers.set(
          snapshot.providers.flatMap((result) => (result.data ? [result.data] : [])),
        );
        this.providerErrors.set(
          snapshot.providers.flatMap((result, index) =>
            result.error
              ? [
                  {
                    label: ['Fiscalidad', 'ERP', 'PSP', 'Contabilidad', 'WhatsApp'][index],
                    message: result.error,
                  },
                ]
              : [],
          ),
        );
        this.sourceErrors.set(
          [snapshot.adapters.error, snapshot.executions.error, snapshot.emailEvents.error].filter(
            (error): error is string => Boolean(error),
          ),
        );
      });
  }

  private catalogItem(configuration: AdapterConfiguration) {
    return this.catalog().find(
      (item) =>
        item.capability === configuration.capability &&
        item.provider === configuration.provider &&
        item.version === configuration.adapterVersion,
    );
  }

  private toDraft(configuration: AdapterConfiguration): AdapterDraft {
    return {
      countryCode: configuration.countryCode,
      provider: configuration.provider,
      adapterVersion: configuration.adapterVersion,
      enabled: configuration.enabled,
      timeoutMs: configuration.timeoutMs,
      maxAttempts: configuration.maxAttempts,
      secretReference: '',
    };
  }

  private message(error: unknown): string {
    return error instanceof ApiError ? error.message : 'No fue posible actualizar el adaptador.';
  }
}
