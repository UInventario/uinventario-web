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
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { Observable, finalize } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { AuthorizationService } from '../../../../core/authorization/authorization.service';
import { InventoryFacade } from '../../application/inventory.facade';
import {
  InventoryLocation,
  InventoryMovement,
  InventoryMovementInput,
  InventoryMovementPage,
  InventoryMovementType,
  InventoryProductDetails,
  InventoryStateTransitionInput,
  InventoryStockItem,
  InventoryStockPage,
  InventoryStockState,
  MovementQuery,
  StockQuery,
} from '../../domain/inventory.models';
import { InventoryMovementDialog } from '../movement-dialog/movement-dialog';
import { InventoryStateTransitionDialog } from '../state-transition-dialog/state-transition-dialog';

type InventoryTab = 'STOCK' | 'MOVEMENTS';
type DialogMode = 'MOVEMENT' | 'STATE';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, InventoryMovementDialog, InventoryStateTransitionDialog, ReactiveFormsModule],
  selector: 'ui-inventory-page',
  styleUrls: ['./inventory-page.scss', './inventory-responsive.scss'],
  templateUrl: './inventory-page.html',
})
export class InventoryPage implements OnInit {
  private readonly inventory = inject(InventoryFacade);
  private readonly authorization = inject(AuthorizationService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private loadRevision = 0;
  private chooserRevision = 0;

  protected readonly tab = signal<InventoryTab>('STOCK');
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly loadingProduct = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly stockPage = signal<InventoryStockPage | null>(null);
  protected readonly movementPage = signal<InventoryMovementPage | null>(null);
  protected readonly locations = signal<readonly InventoryLocation[]>([]);
  protected readonly selectedProduct = signal<InventoryProductDetails | null>(null);
  protected readonly dialogMode = signal<DialogMode | null>(null);
  protected readonly chooserOpen = signal(false);
  protected readonly chooserLoading = signal(false);
  protected readonly chooserResults = signal<readonly InventoryStockItem[]>([]);
  protected readonly canAdjust = computed(() => this.authorization.has('INVENTORY_ADJUST'));

  protected readonly stockFilters = this.formBuilder.nonNullable.group({ q: [''] });
  protected readonly movementFilters = this.formBuilder.nonNullable.group({
    q: [''],
    type: ['' as InventoryMovementType | ''],
    dateFrom: [''],
    dateTo: [''],
  });
  protected readonly chooserForm = this.formBuilder.nonNullable.group({ q: [''] });
  protected readonly movementTypes: readonly {
    value: InventoryMovementType;
    label: string;
  }[] = [
    { value: 'INITIAL', label: 'Stock inicial' },
    { value: 'ENTRY', label: 'Entrada' },
    { value: 'EXIT', label: 'Salida' },
    { value: 'RETURN', label: 'Devolución' },
    { value: 'LOSS', label: 'Pérdida' },
    { value: 'DAMAGE', label: 'Daño' },
    { value: 'ADJUSTMENT', label: 'Ajuste' },
    { value: 'STATE_TRANSITION', label: 'Cambio de estado' },
    { value: 'SALE', label: 'Venta' },
    { value: 'SALE_VOID', label: 'Anulación de venta' },
    { value: 'SALE_RETURN', label: 'Devolución de venta' },
    { value: 'PURCHASE_RECEIPT', label: 'Recepción de compra' },
    { value: 'SUPPLIER_RETURN', label: 'Devolución a proveedor' },
    { value: 'IMPORT', label: 'Importación' },
    { value: 'TRANSFER_OUT', label: 'Transferencia de salida' },
    { value: 'TRANSFER_IN', label: 'Transferencia de entrada' },
    { value: 'TRANSFER_RECEIPT', label: 'Recepción de transferencia' },
    { value: 'TRANSFER_DISCREPANCY', label: 'Diferencia de transferencia' },
  ];

  ngOnInit(): void {
    this.inventory.listLocations().subscribe({
      next: (locations) => this.locations.set(locations),
      error: (error: unknown) => this.error.set(this.messageFor(error)),
    });
    this.route.queryParamMap.subscribe((params) => {
      const tab = params.get('view') === 'movements' ? 'MOVEMENTS' : 'STOCK';
      this.tab.set(tab);
      if (tab === 'STOCK') {
        const query = this.stockQuery(params);
        this.stockFilters.setValue({ q: query.q ?? '' });
        this.loadStock(query);
      } else {
        const query = this.movementQuery(params);
        this.movementFilters.setValue({
          q: query.q ?? '',
          type: query.type ?? '',
          dateFrom: query.dateFrom ?? '',
          dateTo: query.dateTo ?? '',
        });
        this.loadMovements(query);
      }
    });
  }

  protected selectTab(tab: InventoryTab): void {
    if (tab === this.tab()) return;
    this.clearMessages();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: tab === 'MOVEMENTS' ? { view: 'movements' } : {},
    });
  }

  protected applyStockFilters(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: this.stockFilters.controls.q.value.trim() || null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected applyMovementFilters(): void {
    const value = this.movementFilters.getRawValue();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: value.q.trim() || null,
        type: value.type || null,
        dateFrom: value.dateFrom || null,
        dateTo: value.dateTo || null,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected goToPage(page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: page <= 1 ? null : page },
      queryParamsHandling: 'merge',
    });
  }

  protected openChooser(): void {
    if (!this.canAdjust()) return;
    this.clearMessages();
    if (!this.locations().length) {
      this.error.set('Configura una ubicación activa antes de registrar movimientos.');
      return;
    }
    this.chooserForm.reset({ q: '' });
    this.chooserResults.set([]);
    this.chooserOpen.set(true);
    this.searchChooser();
  }

  protected searchChooser(): void {
    const revision = ++this.chooserRevision;
    this.chooserLoading.set(true);
    this.inventory
      .listStock({ q: this.chooserForm.controls.q.value.trim() || undefined, page: 1, pageSize: 8 })
      .pipe(
        finalize(() => {
          if (revision === this.chooserRevision) this.chooserLoading.set(false);
        }),
      )
      .subscribe({
        next: ({ items }) => {
          if (revision === this.chooserRevision) {
            this.chooserResults.set(items.filter(({ product }) => product.active));
          }
        },
        error: (error: unknown) => {
          if (revision === this.chooserRevision) this.error.set(this.messageFor(error));
        },
      });
  }

  protected openMovement(item: InventoryStockItem): void {
    if (!item.product.active) return;
    this.openProductDialog(item.product.id, 'MOVEMENT');
  }

  protected openStateTransition(item: InventoryStockItem): void {
    if (!item.product.active) return;
    this.openProductDialog(item.product.id, 'STATE');
  }

  protected submitMovement(input: InventoryMovementInput): void {
    this.save(this.inventory.createMovement(input), (movement) =>
      movement.pendingSync
        ? 'Movimiento guardado en este dispositivo. Se aplicará al sincronizar.'
        : 'Movimiento registrado. El saldo fue actualizado.',
    );
  }

  protected submitStateTransition(input: InventoryStateTransitionInput): void {
    this.save(
      this.inventory.createStateTransition(input),
      'Estado actualizado. El total físico se conserva.',
    );
  }

  protected closeDialog(): void {
    if (!this.saving()) {
      this.dialogMode.set(null);
      this.selectedProduct.set(null);
      this.error.set(null);
    }
  }

  protected stateQuantity(item: InventoryStockItem, state: InventoryStockState): string {
    return item.states.find(({ code }) => code === state)?.quantity ?? '0.000';
  }

  protected movementLabel(type: InventoryMovementType): string {
    return this.movementTypes.find((item) => item.value === type)?.label ?? type;
  }

  protected movementIcon(direction: InventoryMovement['direction']): string {
    if (direction === 'OUT') return 'pi pi-arrow-down';
    if (direction === 'TRANSFER') return 'pi pi-arrows-h';
    return 'pi pi-arrow-up';
  }

  protected stateLabel(state: InventoryStockState): string {
    return (
      {
        AVAILABLE: 'Disponible',
        RESERVED: 'Reservado',
        DAMAGED: 'Dañado',
        IN_TRANSIT: 'En tránsito',
      } as const
    )[state];
  }

  private openProductDialog(productId: string, mode: DialogMode): void {
    if (!this.canAdjust() || this.loadingProduct()) return;
    this.clearMessages();
    this.loadingProduct.set(true);
    this.inventory
      .getProduct(productId)
      .pipe(finalize(() => this.loadingProduct.set(false)))
      .subscribe({
        next: (product) => {
          if (!product.active) {
            this.error.set('El producto fue retirado y ya no admite movimientos manuales.');
            return;
          }
          this.chooserOpen.set(false);
          this.selectedProduct.set(product);
          this.dialogMode.set(mode);
        },
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  private save(
    request: Observable<InventoryMovement>,
    notice: string | ((movement: InventoryMovement) => string),
  ): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (movement) => {
        this.dialogMode.set(null);
        this.selectedProduct.set(null);
        this.notice.set(typeof notice === 'function' ? notice(movement) : notice);
        this.refresh();
      },
      error: (error: unknown) => this.error.set(this.messageFor(error)),
    });
  }

  private refresh(): void {
    const params = this.route.snapshot.queryParamMap;
    if (this.tab() === 'STOCK') this.loadStock(this.stockQuery(params));
    else this.loadMovements(this.movementQuery(params));
  }

  private loadStock(query: StockQuery): void {
    const revision = ++this.loadRevision;
    this.loading.set(true);
    this.error.set(null);
    this.inventory
      .listStock(query)
      .pipe(finalize(() => revision === this.loadRevision && this.loading.set(false)))
      .subscribe({
        next: (page) => revision === this.loadRevision && this.stockPage.set(page),
        error: (error: unknown) =>
          revision === this.loadRevision && this.error.set(this.messageFor(error)),
      });
  }

  private loadMovements(query: MovementQuery): void {
    const revision = ++this.loadRevision;
    this.loading.set(true);
    this.error.set(null);
    this.inventory
      .listMovements(query)
      .pipe(finalize(() => revision === this.loadRevision && this.loading.set(false)))
      .subscribe({
        next: (page) => revision === this.loadRevision && this.movementPage.set(page),
        error: (error: unknown) =>
          revision === this.loadRevision && this.error.set(this.messageFor(error)),
      });
  }

  private stockQuery(params: ParamMap): StockQuery {
    return { q: params.get('q') ?? undefined, page: this.pageFrom(params), pageSize: 20 };
  }

  private movementQuery(params: ParamMap): MovementQuery {
    const type = params.get('type');
    return {
      q: params.get('q') ?? undefined,
      type: this.movementTypes.some((item) => item.value === type)
        ? (type as InventoryMovementType)
        : undefined,
      dateFrom: params.get('dateFrom') ?? undefined,
      dateTo: params.get('dateTo') ?? undefined,
      page: this.pageFrom(params),
      pageSize: 20,
    };
  }

  private pageFrom(params: ParamMap): number {
    const page = Number(params.get('page'));
    return Number.isInteger(page) && page > 0 ? page : 1;
  }

  private clearMessages(): void {
    this.error.set(null);
    this.notice.set(null);
  }

  private messageFor(error: unknown): string {
    if (!(error instanceof ApiError)) return 'No fue posible actualizar el inventario.';
    const messages: Record<string, string> = {
      INITIAL_STOCK_ALREADY_EXISTS: 'El stock inicial ya fue registrado en esta ubicación.',
      INVALID_STOCK_QUANTITY: 'La cantidad no es válida o dejaría el saldo negativo.',
      MOVEMENT_REFERENCE_REQUIRED: 'La referencia es obligatoria para este movimiento.',
      INSUFFICIENT_STOCK_STATE: 'El estado de origen no tiene cantidad suficiente.',
      INVALID_STOCK_STATE_TRANSITION: 'Ese cambio de estado no está permitido.',
      INVENTORY_LOT_REQUIRED: 'Indica el lote para este producto.',
      INVENTORY_LOT_EXPIRATION_REQUIRED: 'Indica la caducidad del lote.',
      INVENTORY_SERIALS_REQUIRED: 'Indica los números de serie requeridos.',
    };
    return (error.code && messages[error.code]) || error.message;
  }
}
