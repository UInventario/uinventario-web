import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../../core/api/api-error';
import { AuthorizationService } from '../../../../../core/authorization/authorization.service';
import { InventoryOperationsFacade } from '../../application/inventory-operations.facade';
import {
  CountLine,
  CountSession,
  LocationOption,
  ProductOption,
} from '../../domain/inventory-operations.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ReactiveFormsModule],
  selector: 'ui-count-workspace',
  styleUrls: ['./count-workspace.scss', './count-workspace-responsive.scss'],
  templateUrl: './count-workspace.html',
})
export class CountWorkspace implements OnInit {
  private readonly authorization = inject(AuthorizationService);
  private readonly facade = inject(InventoryOperationsFacade);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private createKey: string | null = null;

  protected readonly canCount = computed(() => this.authorization.has('INVENTORY_COUNT'));
  protected readonly canApprove = computed(() => this.authorization.has('INVENTORY_APPROVE'));
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly sessions = signal<readonly CountSession[]>([]);
  protected readonly selected = signal<CountSession | null>(null);
  protected readonly locations = signal<readonly LocationOption[]>([]);
  protected readonly products = signal<readonly ProductOption[]>([]);
  protected readonly createOpen = signal(false);
  protected readonly selectedProducts = signal<readonly string[]>([]);
  protected readonly countValues = signal<Record<string, string>>({});
  protected readonly createForm = this.formBuilder.nonNullable.group({
    locationId: ['', Validators.required],
    blind: false,
    q: '',
  });
  protected readonly closeForm = this.formBuilder.nonNullable.group({
    reason: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(160)]],
    reference: ['', [Validators.required, Validators.maxLength(120)]],
  });
  protected readonly completedLines = computed(
    () => this.selected()?.lines.filter((line) => line.countedQuantity !== null).length ?? 0,
  );

  ngOnInit(): void {
    this.loadContext();
    this.route.queryParamMap.subscribe((params) => {
      const id = params.get('session');
      if (id && id !== this.selected()?.id) this.loadSession(id);
    });
  }

  protected openCreate(): void {
    this.clearMessages();
    this.createKey = this.key();
    this.selectedProducts.set([]);
    this.createForm.reset({ locationId: this.locations()[0]?.id ?? '', blind: false, q: '' });
    this.loadProducts();
    this.createOpen.set(true);
  }

  protected closeCreate(): void {
    if (this.saving()) return;
    this.createOpen.set(false);
    this.createKey = null;
  }

  protected searchProducts(): void {
    this.loadProducts(this.createForm.controls.q.value.trim());
  }

  protected toggleProduct(id: string): void {
    const values = this.selectedProducts();
    this.selectedProducts.set(
      values.includes(id) ? values.filter((value) => value !== id) : [...values, id],
    );
  }

  protected create(): void {
    if (
      this.saving() ||
      this.createForm.invalid ||
      !this.createKey ||
      !this.selectedProducts().length
    )
      return;
    this.clearMessages();
    this.saving.set(true);
    this.facade
      .createCount(
        {
          locationId: this.createForm.controls.locationId.value,
          productIds: this.selectedProducts(),
          blind: this.createForm.controls.blind.value,
        },
        this.createKey,
      )
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (session) => {
          this.createOpen.set(false);
          this.createKey = null;
          this.notice.set('Sesión creada. Los productos quedaron asignados al conteo.');
          this.replaceSession(session);
          this.select(session);
        },
        error: (error: unknown) => this.error.set(this.message(error)),
      });
  }

  protected select(session: CountSession): void {
    this.selected.set(session);
    this.syncInputs(session);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { session: session.id },
      queryParamsHandling: 'merge',
    });
  }

  protected backToList(): void {
    this.selected.set(null);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { session: null },
      queryParamsHandling: 'merge',
    });
  }

  protected hasVariance(value: string | null): boolean {
    return value !== null && Number(value) !== 0;
  }

  protected updateCount(productId: string, value: string): void {
    this.countValues.update((current) => ({ ...current, [productId]: value }));
  }

  protected saveLine(line: CountLine): void {
    const session = this.selected();
    const quantity = this.countValues()[line.product.id]?.trim();
    if (!session || !quantity || this.saving()) return;
    this.clearMessages();
    this.saving.set(true);
    this.facade
      .recordCount(session.id, line.product.id, quantity, line.attemptCount)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updated) => {
          this.notice.set(line.attemptCount ? 'Reconteo registrado.' : 'Conteo registrado.');
          this.replaceSession(updated);
          this.selected.set(updated);
          this.syncInputs(updated);
        },
        error: (error: unknown) => {
          this.error.set(this.message(error));
          this.loadSession(session.id);
        },
      });
  }

  protected closeSession(): void {
    const session = this.selected();
    if (!session || this.saving() || this.closeForm.invalid) return;
    this.clearMessages();
    this.saving.set(true);
    const value = this.closeForm.getRawValue();
    this.facade
      .closeCount(session.id, value.reason, value.reference)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updated) => {
          this.notice.set('Conteo aprobado y ajustes auditados.');
          this.replaceSession(updated);
          this.selected.set(updated);
        },
        error: (error: unknown) => this.error.set(this.message(error)),
      });
  }

  private loadContext(): void {
    this.loading.set(true);
    this.facade
      .countsContext()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ sessions, locations }) => {
          this.sessions.set(sessions);
          this.locations.set(locations);
          const requested = this.route.snapshot.queryParamMap.get('session');
          const session = sessions.find(({ id }) => id === requested) ?? sessions[0] ?? null;
          if (session) this.select(session);
        },
        error: (error: unknown) => this.error.set(this.message(error)),
      });
  }

  private loadSession(id: string): void {
    this.facade.getCount(id).subscribe({
      next: (session) => {
        this.replaceSession(session);
        this.selected.set(session);
        this.syncInputs(session);
      },
      error: (error: unknown) => this.error.set(this.message(error)),
    });
  }

  private loadProducts(q?: string): void {
    this.facade.products(q).subscribe({
      next: (products) => this.products.set(products),
      error: (error: unknown) => this.error.set(this.message(error)),
    });
  }

  private replaceSession(session: CountSession): void {
    this.sessions.update((items) => {
      const exists = items.some(({ id }) => id === session.id);
      return exists
        ? items.map((item) => (item.id === session.id ? session : item))
        : [session, ...items];
    });
  }

  private syncInputs(session: CountSession): void {
    this.countValues.set(
      Object.fromEntries(
        session.lines.map((line) => [line.product.id, line.countedQuantity ?? '']),
      ),
    );
  }

  private clearMessages(): void {
    this.error.set(null);
    this.notice.set(null);
  }

  private key(): string {
    return `web-${crypto.randomUUID()}`;
  }

  private message(error: unknown): string {
    if (!(error instanceof ApiError)) return 'No fue posible completar la operación de conteo.';
    const messages: Record<string, string> = {
      INVENTORY_COUNT_ATTEMPT_CONFLICT: 'Otro usuario capturó este producto. Se recargó la sesión.',
      INVENTORY_COUNT_SESSION_INCOMPLETE: 'Captura todos los productos antes de aprobar.',
      INVENTORY_COUNT_STOCK_CHANGED: 'El stock cambió desde la apertura. Inicia una sesión nueva.',
      INVENTORY_SERIALS_REQUIRED: 'Este producto requiere identificar sus unidades serializadas.',
    };
    return (error.code && messages[error.code]) || error.message;
  }
}
