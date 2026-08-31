import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { ApiError } from '../../../../../core/api/api-error';
import { AuthorizationService } from '../../../../../core/authorization/authorization.service';
import { InventoryFacade } from '../../../application/inventory.facade';
import {
  InventoryLocation,
  InventoryMovementInput,
  InventoryProductDetails,
  InventoryStockItem,
} from '../../../domain/inventory.models';
import { InventoryMovementDialog } from '../../../ui/movement-dialog/movement-dialog';
import { TraceabilityFacade } from '../../application/traceability.facade';
import {
  InventoryLots,
  InventorySerial,
  InventorySerialHistory,
  InventorySerials,
  InventorySerialStatus,
  LotExpirationAlert,
  LotExpirationAlerts,
  LotExpirationStatus,
} from '../../domain/traceability.models';

type AlertFilter = 'ALL' | 'EXPIRING' | 'EXPIRED';
type SerialFilter = 'ALL' | InventorySerialStatus;

const EMPTY_LOTS: InventoryLots = {
  items: [],
  tracked: false,
  totalQuantity: '0.000',
  lotQuantity: '0.000',
  reconciled: true,
  currency: null,
  inventoryValue: '0.00',
};
const EMPTY_SERIALS: InventorySerials = { items: [], tracked: false };

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, InventoryMovementDialog, ReactiveFormsModule, RouterLink],
  selector: 'ui-traceability-page',
  styleUrls: [
    './traceability-page.scss',
    './traceability-detail.scss',
    './traceability-history.scss',
    './traceability-responsive.scss',
  ],
  templateUrl: './traceability-page.html',
})
export class TraceabilityPage implements OnInit {
  private readonly traceability = inject(TraceabilityFacade);
  private readonly inventory = inject(InventoryFacade);
  private readonly authorization = inject(AuthorizationService);
  private productRevision = 0;

  protected readonly searchForm = new FormBuilder().nonNullable.group({ query: [''] });
  protected readonly products = signal<readonly InventoryStockItem[]>([]);
  protected readonly locations = signal<readonly InventoryLocation[]>([]);
  protected readonly selectedProduct = signal<InventoryProductDetails | null>(null);
  protected readonly lots = signal<InventoryLots | null>(null);
  protected readonly serials = signal<InventorySerials | null>(null);
  protected readonly alerts = signal<LotExpirationAlerts | null>(null);
  protected readonly history = signal<InventorySerialHistory | null>(null);
  protected readonly loadingProducts = signal(true);
  protected readonly loadingTracking = signal(false);
  protected readonly loadingHistory = signal(false);
  protected readonly saving = signal(false);
  protected readonly movementOpen = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly alertFilter = signal<AlertFilter>('ALL');
  protected readonly alertQuery = signal('');
  protected readonly serialFilter = signal<SerialFilter>('ALL');
  protected readonly serialQuery = signal('');
  protected readonly canAdjust = computed(() => this.authorization.has('INVENTORY_ADJUST'));
  protected readonly expiredCount = computed(
    () => this.alerts()?.items.filter(({ status }) => status === 'EXPIRED').length ?? 0,
  );
  protected readonly expiringCount = computed(
    () => this.alerts()?.items.filter(({ status }) => status === 'EXPIRING').length ?? 0,
  );
  protected readonly filteredAlerts = computed(() => {
    const status = this.alertFilter();
    const query = this.alertQuery().trim().toLocaleLowerCase();
    return (this.alerts()?.items ?? []).filter(
      (alert) =>
        (status === 'ALL' || alert.status === status) &&
        (!query ||
          [alert.product.name, alert.product.sku, alert.lot.code, alert.location.name].some(
            (value) => value.toLocaleLowerCase().includes(query),
          )),
    );
  });
  protected readonly filteredSerials = computed(() => {
    const status = this.serialFilter();
    const query = this.serialQuery().trim().toLocaleLowerCase();
    return (this.serials()?.items ?? []).filter(
      (serial) =>
        (status === 'ALL' || serial.status === status) &&
        (!query || serial.serialNumber.toLocaleLowerCase().includes(query)),
    );
  });

  protected readonly serialStatuses: readonly { value: SerialFilter; label: string }[] = [
    { value: 'ALL', label: 'Todos los estados' },
    { value: 'AVAILABLE', label: 'Disponible' },
    { value: 'RESERVED', label: 'Reservada' },
    { value: 'IN_TRANSIT', label: 'En tránsito' },
    { value: 'DAMAGED', label: 'Dañada' },
    { value: 'SOLD', label: 'Vendida' },
    { value: 'RETURNED_TO_SUPPLIER', label: 'Devuelta a proveedor' },
    { value: 'REMOVED', label: 'Retirada' },
  ];

  ngOnInit(): void {
    this.loadProducts('');
    this.loadAlerts();
    this.inventory.listLocations().subscribe({
      next: (locations) => this.locations.set(locations),
      error: (error: unknown) => this.error.set(this.messageFor(error)),
    });
  }

  protected searchProducts(): void {
    this.loadProducts(this.searchForm.controls.query.value.trim());
  }

  protected selectProduct(item: InventoryStockItem): void {
    this.loadProduct(item.product.id);
  }

  protected selectAlert(alert: LotExpirationAlert): void {
    this.loadProduct(alert.product.id);
  }

  protected openMovement(): void {
    if (!this.canAdjust() || !this.selectedProduct() || !this.locations().length) return;
    this.error.set(null);
    this.movementOpen.set(true);
  }

  protected saveMovement(input: InventoryMovementInput): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.inventory.createMovement(input).subscribe({
      next: () => {
        this.saving.set(false);
        this.movementOpen.set(false);
        this.loadProduct(input.productId);
        this.loadAlerts();
        this.notice.set('Movimiento registrado; trazabilidad y alertas actualizadas.');
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(this.messageFor(error));
      },
    });
  }

  protected openHistory(serial: InventorySerial): void {
    this.loadingHistory.set(true);
    this.history.set(null);
    this.error.set(null);
    this.traceability.serialHistory(serial.id).subscribe({
      next: (history) => {
        this.history.set(history);
        this.loadingHistory.set(false);
      },
      error: (error: unknown) => {
        this.loadingHistory.set(false);
        this.error.set(this.messageFor(error));
      },
    });
  }

  protected lotStatus(status: LotExpirationStatus): string {
    return {
      NO_EXPIRATION: 'Sin vencimiento',
      ACTIVE: 'Vigente',
      EXPIRING: 'Próximo a vencer',
      EXPIRED: 'Vencido',
      EXHAUSTED: 'Agotado',
    }[status];
  }

  protected serialStatus(status: InventorySerialStatus): string {
    return this.serialStatuses.find(({ value }) => value === status)?.label ?? status;
  }

  protected movementLabel(type: string): string {
    return (
      {
        INITIAL: 'Stock inicial',
        ENTRY: 'Entrada',
        EXIT: 'Salida',
        RETURN: 'Devolución',
        LOSS: 'Pérdida',
        DAMAGE: 'Daño',
        ADJUSTMENT: 'Ajuste',
        TRANSFER_OUT: 'Transferencia de salida',
        TRANSFER_IN: 'Transferencia de entrada',
        TRANSFER_RECEIPT: 'Recepción de transferencia',
        SALE: 'Venta',
        SALE_VOID: 'Anulación de venta',
        SALE_RETURN: 'Devolución de venta',
        PURCHASE_RECEIPT: 'Recepción de compra',
        SUPPLIER_RETURN: 'Devolución a proveedor',
      }[type] ?? type
    );
  }

  private loadProducts(query: string): void {
    this.loadingProducts.set(true);
    this.error.set(null);
    this.inventory.listStock({ q: query || undefined, page: 1, pageSize: 50 }).subscribe({
      next: (page) => {
        this.products.set(page.items);
        this.loadingProducts.set(false);
      },
      error: (error: unknown) => {
        this.loadingProducts.set(false);
        this.error.set(this.messageFor(error));
      },
    });
  }

  private loadAlerts(): void {
    this.traceability.listExpirationAlerts().subscribe({
      next: (alerts) => this.alerts.set(alerts),
      error: (error: unknown) => this.error.set(this.messageFor(error)),
    });
  }

  private loadProduct(productId: string): void {
    const revision = ++this.productRevision;
    this.loadingTracking.set(true);
    this.history.set(null);
    this.notice.set(null);
    this.error.set(null);
    this.inventory.getProduct(productId).subscribe({
      next: (product) => {
        if (revision !== this.productRevision) return;
        this.selectedProduct.set(product);
        forkJoin({
          lots: product.trackLots ? this.traceability.listLots(product.id) : of(EMPTY_LOTS),
          serials: product.trackSerials
            ? this.traceability.listSerials(product.id)
            : of(EMPTY_SERIALS),
        }).subscribe({
          next: ({ lots, serials }) => {
            if (revision !== this.productRevision) return;
            this.lots.set(lots);
            this.serials.set(serials);
            this.loadingTracking.set(false);
          },
          error: (error: unknown) => {
            if (revision !== this.productRevision) return;
            this.loadingTracking.set(false);
            this.error.set(this.messageFor(error));
          },
        });
      },
      error: (error: unknown) => {
        if (revision !== this.productRevision) return;
        this.loadingTracking.set(false);
        this.error.set(this.messageFor(error));
      },
    });
  }

  private messageFor(error: unknown): string {
    if (!(error instanceof ApiError)) return 'No fue posible consultar la trazabilidad.';
    const messages: Record<string, string> = {
      INVENTORY_LOT_REQUIRED: 'Indica el lote para este producto.',
      INVENTORY_LOT_EXPIRATION_REQUIRED: 'Indica la fecha de caducidad del lote.',
      INVENTORY_SERIALS_REQUIRED: 'Captura una serie por cada unidad.',
      INVENTORY_SERIAL_STATE_CONFLICT: 'Una serie ya existe o no está disponible.',
      INVALID_INVENTORY_LOT_DATES: 'Revisa las fechas de fabricación y caducidad.',
    };
    return messages[error.code] ?? error.message;
  }
}
