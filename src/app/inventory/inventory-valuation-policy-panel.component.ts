import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { SessionApiService } from '../auth/session-api.service';
import {
  InventoryApiService,
  InventoryValuationMethod,
  InventoryValuationMigrationPlan,
  InventoryValuationPolicyData,
} from './inventory-api.service';

@Component({
  selector: 'app-inventory-valuation-policy-panel',
  imports: [DatePipe],
  templateUrl: './inventory-valuation-policy-panel.component.html',
  styleUrl: './inventory-valuation-policy-panel.component.scss',
})
export class InventoryValuationPolicyPanelComponent implements OnInit {
  private readonly inventory = inject(InventoryApiService);
  private readonly sessions = inject(SessionApiService);
  private pendingChange: {
    fingerprint: string;
    targetMethod: InventoryValuationMethod;
    key: string;
  } | null = null;

  protected readonly canManage = computed(
    () => this.sessions.session()?.user.permissions.includes('INVENTORY_VALUATION_MANAGE') ?? false,
  );
  protected readonly policy = signal<InventoryValuationPolicyData | null>(null);
  protected readonly selectedMethod = signal<InventoryValuationMethod>('FIFO');
  protected readonly preview = signal<InventoryValuationMigrationPlan | null>(null);
  protected readonly loading = signal(true);
  protected readonly previewing = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected selectMethod(event: Event): void {
    this.selectedMethod.set((event.target as HTMLSelectElement).value as InventoryValuationMethod);
    this.preview.set(null);
    this.pendingChange = null;
    this.error.set(null);
    this.success.set(null);
  }

  protected createPreview(): void {
    if (!this.canManage() || this.previewing()) return;
    this.previewing.set(true);
    this.error.set(null);
    this.success.set(null);
    this.inventory
      .previewValuationPolicy(this.selectedMethod())
      .pipe(finalize(() => this.previewing.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.preview.set(data);
          this.pendingChange = null;
        },
        error: (error: HttpErrorResponse) => this.error.set(this.messageFor(error)),
      });
  }

  protected confirmChange(): void {
    const plan = this.preview();
    if (!plan?.allowed || !this.canManage() || this.saving()) return;
    const key =
      this.pendingChange?.fingerprint === plan.planFingerprint &&
      this.pendingChange.targetMethod === plan.targetMethod
        ? this.pendingChange.key
        : `web-valuation-cutover-${globalThis.crypto.randomUUID()}`;
    this.pendingChange = {
      fingerprint: plan.planFingerprint,
      targetMethod: plan.targetMethod,
      key,
    };
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.inventory
      .changeValuationPolicy(
        {
          targetMethod: plan.targetMethod,
          expectedVersion: plan.current.version,
          planFingerprint: plan.planFingerprint,
        },
        key,
      )
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.pendingChange = null;
          this.policy.set(data);
          this.preview.set(null);
          this.selectedMethod.set(data.method);
          this.success.set(
            'Método actualizado. Los dispositivos offline deberán descargar un bootstrap nuevo.',
          );
        },
        error: (error: HttpErrorResponse) => {
          if (error.status > 0 && error.status < 500) this.pendingChange = null;
          this.error.set(this.messageFor(error));
        },
      });
  }

  protected methodLabel(method: InventoryValuationMethod): string {
    return {
      MOVING_AVERAGE: 'Promedio móvil',
      FIFO: 'FIFO',
      SPECIFIC_LOT: 'Costo específico por lote',
    }[method];
  }

  protected strategyLabel(plan: InventoryValuationMigrationPlan): string {
    return {
      USE_MAINTAINED_MOVING_AVERAGE:
        'Activa la proyección de promedio ya mantenida; no reescribe movimientos anteriores.',
      USE_MAINTAINED_FIFO_LAYERS:
        'Activa las capas FIFO conciliadas; no reescribe movimientos anteriores.',
      OPENING_LOTS_AT_MOVING_AVERAGE:
        'Habilita seguimiento y crea lotes de apertura al costo promedio del corte.',
    }[plan.strategy];
  }

  protected blockingLabel(code: string): string {
    return (
      {
        METHOD_ALREADY_ACTIVE: 'El método seleccionado ya está activo.',
        FIFO_LAYER_RECONCILIATION_REQUIRED:
          'Las capas FIFO deben conciliar con las existencias antes del cambio.',
        LOT_RECONCILIATION_REQUIRED:
          'Los lotes existentes deben conciliar con las existencias antes del cambio.',
      }[code] ?? code
    );
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.inventory
      .getValuationPolicy()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.policy.set(data);
          this.selectedMethod.set(data.method === 'FIFO' ? 'MOVING_AVERAGE' : 'FIFO');
        },
        error: (error: HttpErrorResponse) => this.error.set(this.messageFor(error)),
      });
  }

  private messageFor(error: HttpErrorResponse): string {
    const code = (error.error as { code?: string } | null)?.code;
    if (code === 'VALUATION_MIGRATION_PLAN_STALE' || code === 'VALUATION_POLICY_VERSION_CONFLICT') {
      this.preview.set(null);
      return 'El inventario o la configuración cambiaron. Genera una prevalidación nueva.';
    }
    if (code === 'VALUATION_METHOD_CHANGE_BLOCKED') {
      return 'La prevalidación detectó saldos que deben conciliarse antes del cambio.';
    }
    if (error.status === 403) return 'No tienes permiso para cambiar el método de valorización.';
    if (error.status === 0) return 'No fue posible conectar con el servicio de inventario.';
    return 'No fue posible procesar la configuración de valorización.';
  }
}
