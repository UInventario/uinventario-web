import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { CommerceFacade } from '../../application/commerce.facade';
import { CommerceCredentialDialogs } from '../commerce-credential-dialogs/commerce-credential-dialogs';
import {
  CommerceContract,
  CommerceContextOption,
  CommerceCredential,
  CommerceDelivery,
  CommerceOperation,
  CommerceOptions,
  CommerceScope,
  CommerceWebhookEvent,
} from '../../domain/commerce.models';

type CommercePanel = 'channels' | 'sync' | 'contract';

const SCOPES: readonly CommerceScope[] = [
  'CATALOG_READ',
  'STOCK_READ',
  'ORDERS_WRITE',
  'ORDERS_READ',
];
const EVENTS: readonly CommerceWebhookEvent[] = [
  'ORDER_CONFIRMED',
  'ORDER_PREPARING',
  'ORDER_READY',
  'ORDER_DELIVERED',
  'ORDER_CANCELLED',
  'ORDER_FULFILLMENT_UPDATED',
];

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommerceCredentialDialogs, DatePipe],
  selector: 'ui-commerce-console-page',
  styleUrl: './commerce-console-page.scss',
  templateUrl: './commerce-console-page.html',
})
export class CommerceConsolePage implements OnInit {
  private readonly facade = inject(CommerceFacade);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly scopes = SCOPES;
  protected readonly events = EVENTS;
  protected readonly panel = signal<CommercePanel>('channels');
  protected readonly loading = signal(true);
  protected readonly acting = signal(false);
  protected readonly editorOpen = signal(false);
  protected readonly credentials = signal<readonly CommerceCredential[]>([]);
  protected readonly deliveries = signal<readonly CommerceDelivery[]>([]);
  protected readonly contract = signal<CommerceContract | null>(null);
  protected readonly options = signal<CommerceOptions>({ contexts: [], customers: [] });
  protected readonly operations = signal<readonly CommerceOperation[]>([]);
  protected readonly sourceErrors = signal<readonly string[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly oneTimeKey = signal<string | null>(null);
  protected readonly revealKey = signal(false);
  protected readonly failedDeliveries = computed(
    () =>
      this.deliveries().filter(({ status }) => ['FAILED', 'RETRYABLE_FAILURE'].includes(status))
        .length,
  );

  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(80)]],
    contextId: ['', Validators.required],
    customerId: ['', Validators.required],
    rateLimitPerMinute: [60, [Validators.required, Validators.min(10), Validators.max(600)]],
    webhookEnabled: false,
    webhookUrl: [''],
    scopes: this.formBuilder.nonNullable.control<readonly CommerceScope[]>([...SCOPES]),
    webhookEvents: this.formBuilder.nonNullable.control<readonly CommerceWebhookEvent[]>([
      ...EVENTS,
    ]),
  });

  ngOnInit(): void {
    this.load();
  }

  protected selectPanel(panel: CommercePanel): void {
    this.panel.set(panel);
    this.error.set(null);
  }

  protected openEditor(): void {
    this.editorOpen.set(true);
    this.form.patchValue({
      contextId: this.options().contexts[0]?.id ?? '',
      customerId: this.options().customers[0]?.id ?? '',
    });
  }

  protected closeEditor(): void {
    this.editorOpen.set(false);
  }

  protected toggleScope(scope: CommerceScope, checked: boolean): void {
    const current = this.form.controls.scopes.value;
    this.form.controls.scopes.setValue(
      checked ? [...new Set([...current, scope])] : current.filter((item) => item !== scope),
    );
  }

  protected toggleEvent(event: CommerceWebhookEvent, checked: boolean): void {
    const current = this.form.controls.webhookEvents.value;
    this.form.controls.webhookEvents.setValue(
      checked ? [...new Set([...current, event])] : current.filter((item) => item !== event),
    );
  }

  protected create(): void {
    this.error.set(null);
    const value = this.form.getRawValue();
    const context = this.options().contexts.find(({ id }) => id === value.contextId);
    if (this.form.invalid || !context || !value.scopes.length) {
      this.form.markAllAsTouched();
      this.error.set('Completa el nombre, contexto, cliente y al menos un alcance.');
      return;
    }
    if (value.webhookEnabled && !value.webhookUrl.trim().startsWith('https://')) {
      this.error.set('El webhook activo requiere una URL HTTPS.');
      return;
    }
    this.acting.set(true);
    this.facade
      .create({
        name: value.name,
        scopes: value.scopes,
        ...this.contextInput(context),
        customerId: value.customerId,
        rateLimitPerMinute: value.rateLimitPerMinute,
        webhookUrl: value.webhookUrl,
        webhookEvents: value.webhookEvents,
        webhookEnabled: value.webhookEnabled,
      })
      .pipe(finalize(() => this.acting.set(false)))
      .subscribe({
        next: ({ credential, oneTimeApiKey }) => {
          this.credentials.update((items) => [credential, ...items]);
          this.oneTimeKey.set(oneTimeApiKey);
          this.revealKey.set(false);
          this.editorOpen.set(false);
          this.form.reset({
            name: '',
            contextId: this.options().contexts[0]?.id ?? '',
            customerId: this.options().customers[0]?.id ?? '',
            rateLimitPerMinute: 60,
            webhookEnabled: false,
            webhookUrl: '',
            scopes: [...SCOPES],
            webhookEvents: [...EVENTS],
          });
        },
        error: (error: unknown) => this.error.set(this.message(error)),
      });
  }

  protected rotate(credential: CommerceCredential): void {
    if (
      this.acting() ||
      !window.confirm(
        `¿Rotar la credencial “${credential.name}”? La clave anterior dejará de funcionar.`,
      )
    )
      return;
    this.acting.set(true);
    this.facade
      .rotate(credential.id)
      .pipe(finalize(() => this.acting.set(false)))
      .subscribe({
        next: ({ credential: updated, oneTimeApiKey }) => {
          this.replaceCredential(updated);
          this.oneTimeKey.set(oneTimeApiKey);
          this.revealKey.set(false);
        },
        error: (error: unknown) => this.error.set(this.message(error)),
      });
  }

  protected revoke(credential: CommerceCredential): void {
    if (
      this.acting() ||
      !window.confirm(`¿Revocar “${credential.name}”? El canal perderá acceso inmediatamente.`)
    )
      return;
    this.acting.set(true);
    this.facade
      .revoke(credential.id)
      .pipe(finalize(() => this.acting.set(false)))
      .subscribe({
        next: () => {
          this.replaceCredential({ ...credential, active: false });
          this.notice.set('Credencial revocada.');
        },
        error: (error: unknown) => this.error.set(this.message(error)),
      });
  }

  protected replay(delivery: CommerceDelivery): void {
    if (!this.canReplay(delivery) || this.acting()) return;
    this.acting.set(true);
    this.facade
      .replay(delivery.id)
      .pipe(finalize(() => this.acting.set(false)))
      .subscribe({
        next: (updated) => {
          this.deliveries.update((items) =>
            items.map((item) => (item.id === updated.id ? updated : item)),
          );
          this.notice.set(`Entrega conciliada: ${updated.status}.`);
        },
        error: (error: unknown) => this.error.set(this.message(error)),
      });
  }

  protected canReplay(delivery: CommerceDelivery): boolean {
    return ['FAILED', 'RETRYABLE_FAILURE'].includes(delivery.status) && delivery.attemptCount < 5;
  }

  protected async copyKey(): Promise<void> {
    const key = this.oneTimeKey();
    if (!key) return;
    await navigator.clipboard.writeText(key);
    this.notice.set('Clave copiada. Guárdala en tu gestor seguro.');
  }

  protected closeKey(): void {
    this.oneTimeKey.set(null);
    this.revealKey.set(false);
  }

  private load(): void {
    this.facade
      .load()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((snapshot) => {
        this.credentials.set(snapshot.credentials.data ?? []);
        this.deliveries.set(snapshot.deliveries.data ?? []);
        this.contract.set(snapshot.contract.data);
        this.operations.set(this.facade.operations(snapshot.contract.data));
        this.options.set(snapshot.options.data ?? { contexts: [], customers: [] });
        this.sourceErrors.set(
          [
            snapshot.credentials.error,
            snapshot.deliveries.error,
            snapshot.contract.error,
            snapshot.options.error,
          ].filter((item): item is string => Boolean(item)),
        );
      });
  }

  private replaceCredential(updated: CommerceCredential): void {
    this.credentials.update((items) =>
      items.map((item) => (item.id === updated.id ? updated : item)),
    );
  }

  private contextInput(context: CommerceContextOption) {
    return {
      branchId: context.branchId,
      warehouseId: context.warehouseId,
      cashRegisterId: context.cashRegisterId,
      locationId: context.locationId,
    };
  }

  private message(error: unknown): string {
    return error instanceof ApiError ? error.message : 'No fue posible completar la operación.';
  }
}
