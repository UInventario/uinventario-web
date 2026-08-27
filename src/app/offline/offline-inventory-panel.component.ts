import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SessionApiService } from '../auth/session-api.service';
import { OfflineBootstrapEntity } from './offline-bootstrap-api.service';
import { OfflineScopeIdentity, OfflineStoreService } from './offline-store.service';

type OfflineInventoryOperation = 'COUNT' | 'ENTRY' | 'EXIT' | 'RETURN' | 'LOSS' | 'DAMAGE';

interface OfflineProduct extends OfflineBootstrapEntity {
  kind: 'PRODUCT';
  sku: string;
  name: string;
  active: boolean;
}

interface OfflineLocation extends OfflineBootstrapEntity {
  kind: 'LOCATION';
  warehouseId: string;
  code: string;
  name: string;
  active: boolean;
}

interface OfflineAvailability extends OfflineBootstrapEntity {
  kind: 'INVENTORY_AVAILABILITY';
  productId: string;
  locationId: string;
  availableQuantity: string;
}

const QUANTITY_PATTERN = /^(0|[1-9]\d{0,11})(\.\d{1,3})?$/;

@Component({
  selector: 'app-offline-inventory-panel',
  imports: [ReactiveFormsModule],
  templateUrl: './offline-inventory-panel.component.html',
  styleUrl: './offline-inventory-panel.component.scss',
})
export class OfflineInventoryPanelComponent implements OnInit {
  private readonly forms = inject(FormBuilder);
  private readonly sessions = inject(SessionApiService);
  private readonly store = inject(OfflineStoreService);

  protected readonly products = signal<OfflineProduct[]>([]);
  protected readonly locations = signal<OfflineLocation[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly operations = signal<
    Array<{ value: OfflineInventoryOperation; label: string }>
  >([]);

  protected readonly form = this.forms.nonNullable.group({
    operation: ['', Validators.required],
    productId: ['', Validators.required],
    locationId: ['', Validators.required],
    quantity: ['', [Validators.required, Validators.pattern(QUANTITY_PATTERN)]],
    reason: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(160)]],
    reference: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
  });

  private availability: OfflineAvailability[] = [];

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const session = this.sessions.session();
      const warehouseId = session?.context.warehouse?.id;
      if (!session || !warehouseId) throw new Error('Selecciona una bodega activa.');
      const permissions = session.user.permissions;
      const operations: Array<{ value: OfflineInventoryOperation; label: string }> = [];
      if (permissions.includes('INVENTORY_COUNT')) {
        operations.push({ value: 'COUNT', label: 'Conteo físico' });
      }
      if (permissions.includes('INVENTORY_ADJUST')) {
        operations.push(
          { value: 'ENTRY', label: 'Entrada' },
          { value: 'EXIT', label: 'Salida' },
          { value: 'RETURN', label: 'Devolución' },
          { value: 'LOSS', label: 'Pérdida' },
          { value: 'DAMAGE', label: 'Daño' },
        );
      }
      const scope = await this.scope();
      const freshness = await this.store.freshness(scope);
      if (!freshness.allowedActions.INVENTORY_COUNT) {
        const countIndex = operations.findIndex(({ value }) => value === 'COUNT');
        if (countIndex >= 0) operations.splice(countIndex, 1);
      }
      if (!freshness.allowedActions.INVENTORY_MOVEMENT) {
        for (let index = operations.length - 1; index >= 0; index -= 1) {
          if (operations[index].value !== 'COUNT') operations.splice(index, 1);
        }
      }
      this.operations.set([...operations]);
      const [products, locations, availability] = await Promise.all([
        this.store.entities<OfflineProduct>(scope, 'PRODUCT'),
        this.store.entities<OfflineLocation>(scope, 'LOCATION'),
        this.store.entities<OfflineAvailability>(scope, 'INVENTORY_AVAILABILITY'),
      ]);
      this.products.set(products.filter(({ active }) => active));
      this.locations.set(
        locations.filter(({ active, warehouseId: id }) => active && id === warehouseId),
      );
      this.availability = availability;
      this.form.patchValue({
        operation: operations[0]?.value ?? '',
        productId: this.products()[0]?.id ?? '',
        locationId: this.locations()[0]?.id ?? '',
      });
      if (!operations.length)
        throw new Error('No tienes permisos para capturar inventario offline.');
      if (!this.products().length || !this.locations().length) {
        throw new Error('Prepara la descarga offline para obtener productos y ubicaciones.');
      }
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : 'No fue posible cargar los datos offline.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  protected async submit(): Promise<void> {
    if (this.saving() || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    if (value.operation !== 'COUNT' && Number(value.quantity) <= 0) {
      this.error.set('La cantidad del movimiento debe ser mayor que cero.');
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    try {
      const scope = await this.scope();
      const common = {
        productId: value.productId,
        locationId: value.locationId,
        reason: value.reason.trim(),
        reference: value.reference.trim(),
      };
      let command;
      if (value.operation === 'COUNT') {
        await this.store.assertAction(scope, 'INVENTORY_COUNT');
        command = await this.store.queue(scope, 'INVENTORY_COUNT', {
          ...common,
          countedQuantity: value.quantity,
          snapshotQuantity:
            this.availability.find(
              ({ productId, locationId }) =>
                productId === value.productId && locationId === value.locationId,
            )?.availableQuantity ?? '0.000',
          capturedAt: new Date().toISOString(),
        });
      } else {
        await this.store.assertAction(scope, 'INVENTORY_MOVEMENT');
        command = await this.store.queue(scope, 'INVENTORY_MOVEMENT', {
          ...common,
          type: value.operation,
          quantity: value.quantity,
        });
      }
      this.success.set(`Operación #${command.sequence} guardada para sincronización.`);
      this.form.patchValue({ quantity: '', reason: '', reference: '' });
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : 'No fue posible guardar la operación.',
      );
    } finally {
      this.saving.set(false);
    }
  }

  private async scope(): Promise<OfflineScopeIdentity> {
    const session = this.sessions.session();
    if (!session) throw new Error('La sesión ya no está disponible.');
    return {
      tenantId: session.tenant.id,
      userId: session.user.id,
      deviceId: await this.store.deviceId(),
      branchId: session.context.branch?.id ?? null,
      cashRegisterId: session.context.cashRegister?.id ?? null,
    };
  }
}
