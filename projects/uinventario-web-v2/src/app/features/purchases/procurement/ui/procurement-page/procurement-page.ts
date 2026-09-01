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
import { finalize, forkJoin } from 'rxjs';
import { ApiError } from '../../../../../core/api/api-error';
import { AuthorizationService } from '../../../../../core/authorization/authorization.service';
import { ProcurementFacade } from '../../application/procurement.facade';
import {
  PurchaseOrder,
  PurchaseOrderInput,
  PurchaseOrderPage,
  PurchaseReceipt,
  PurchaseReceiptInput,
  PurchaseReturnInput,
  PurchaseTransitionAction,
  ReceiptLocation,
  SupplierOption,
  SupplierProductOption,
} from '../../domain/procurement.models';
import { OrderDetail } from '../order-detail/order-detail';
import { OrderEditorDialog } from '../order-editor-dialog/order-editor-dialog';
import { OrderList } from '../order-list/order-list';
import { ReceiptDialog } from '../receipt-dialog/receipt-dialog';
import { ReturnDialog } from '../return-dialog/return-dialog';
import { TransitionDialog } from '../transition-dialog/transition-dialog';

interface TransitionRequest {
  readonly order: PurchaseOrder;
  readonly action: PurchaseTransitionAction;
}

interface TransitionContext extends TransitionRequest {
  readonly idempotencyKey: string;
}

interface ReceiptContext {
  readonly order: PurchaseOrder;
  readonly idempotencyKey: string;
}

interface ReturnRequest {
  readonly order: PurchaseOrder;
  readonly receipt: PurchaseReceipt;
}

interface ReturnContext extends ReturnRequest {
  readonly idempotencyKey: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    OrderDetail,
    OrderEditorDialog,
    OrderList,
    ReceiptDialog,
    ReturnDialog,
    TransitionDialog,
  ],
  selector: 'ui-procurement-page',
  styleUrls: ['./procurement-page.scss', './procurement-responsive.scss'],
  templateUrl: './procurement-page.html',
})
export class ProcurementPage implements OnInit {
  private readonly authorization = inject(AuthorizationService);
  private readonly facade = inject(ProcurementFacade);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private listRevision = 0;
  private detailRevision = 0;
  private productRevision = 0;
  private listKey = '';
  private detailKey = '';

  protected readonly canManage = computed(() =>
    this.authorization.permissions().has('PURCHASE_ORDERS_MANAGE'),
  );
  protected readonly canApprove = computed(() =>
    this.authorization.permissions().has('PURCHASE_ORDERS_APPROVE'),
  );
  protected readonly canOverReceive = computed(() =>
    this.authorization.permissions().has('PURCHASE_RECEIPTS_OVERAGE'),
  );
  protected readonly loading = signal(true);
  protected readonly detailLoading = signal(false);
  protected readonly productsLoading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly page = signal<PurchaseOrderPage | null>(null);
  protected readonly selected = signal<PurchaseOrder | null>(null);
  protected readonly suppliers = signal<readonly SupplierOption[]>([]);
  protected readonly supplierProducts = signal<readonly SupplierProductOption[]>([]);
  protected readonly locations = signal<readonly ReceiptLocation[]>([]);
  protected readonly editor = signal<PurchaseOrder | null | undefined>(undefined);
  protected readonly transition = signal<TransitionContext | null>(null);
  protected readonly receiving = signal<ReceiptContext | null>(null);
  protected readonly returning = signal<ReturnContext | null>(null);
  protected readonly filters = this.formBuilder.nonNullable.group({ q: [''] });

  ngOnInit(): void {
    if (this.canManage()) this.loadReferences();
    this.route.queryParamMap.subscribe((params) => this.syncFrom(params));
  }

  protected applyFilters(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: this.filters.controls.q.value.trim() || null,
        page: null,
        order: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected goToPage(page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: page <= 1 ? null : page, order: null },
      queryParamsHandling: 'merge',
    });
  }

  protected selectOrder(order: PurchaseOrder): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { order: order.id },
      queryParamsHandling: 'merge',
    });
  }

  protected clearSelection(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { order: null },
      queryParamsHandling: 'merge',
    });
  }

  protected openCreate(): void {
    if (!this.canManage()) return;
    this.clearMessages();
    this.supplierProducts.set([]);
    this.editor.set(null);
  }

  protected openEdit(order: PurchaseOrder): void {
    if (!this.canManage() || order.status !== 'DRAFT') return;
    this.clearMessages();
    this.loadSupplierProducts(order.supplier.id);
    this.editor.set(order);
  }

  protected loadSupplierProducts(supplierId: string): void {
    const revision = ++this.productRevision;
    this.supplierProducts.set([]);
    if (!supplierId) return;
    this.productsLoading.set(true);
    this.facade
      .listSupplierProducts(supplierId)
      .pipe(finalize(() => revision === this.productRevision && this.productsLoading.set(false)))
      .subscribe({
        next: (products) =>
          revision === this.productRevision && this.supplierProducts.set(products),
        error: (error: unknown) =>
          revision === this.productRevision && this.error.set(this.messageFor(error)),
      });
  }

  protected saveOrder(input: PurchaseOrderInput): void {
    const current = this.editor() ?? undefined;
    this.mutate(
      this.facade.save(input, current),
      current ? 'Borrador actualizado.' : 'Borrador creado.',
      (order) => {
        this.editor.set(undefined);
        if (!current) this.navigateTo(order.id);
      },
    );
  }

  protected requestTransition(context: TransitionRequest): void {
    this.clearMessages();
    this.transition.set({ ...context, idempotencyKey: this.idempotencyKey() });
  }

  protected submitTransition(reason?: string): void {
    const context = this.transition();
    if (!context) return;
    const messages = {
      APPROVE: 'Orden aprobada.',
      SEND: 'Envío de la orden registrado.',
      CANCEL: 'Orden cancelada.',
    };
    this.mutate(
      this.facade.transition(context.order, context.action, context.idempotencyKey, reason),
      messages[context.action],
      () => this.transition.set(null),
    );
  }

  protected requestReceipt(order: PurchaseOrder): void {
    this.clearMessages();
    if (!this.locations().length) {
      this.error.set('No hay ubicaciones activas en la bodega actual para recibir productos.');
      return;
    }
    this.receiving.set({ order, idempotencyKey: this.idempotencyKey() });
  }

  protected submitReceipt(input: PurchaseReceiptInput): void {
    const context = this.receiving();
    if (!context) return;
    this.mutate(
      this.facade.receive(context.order, input, context.idempotencyKey),
      'Recepción registrada e inventario actualizado.',
      () => this.receiving.set(null),
    );
  }

  protected requestReturn(context: ReturnRequest): void {
    this.clearMessages();
    this.returning.set({ ...context, idempotencyKey: this.idempotencyKey() });
  }

  protected submitReturn(input: PurchaseReturnInput): void {
    const context = this.returning();
    if (!context) return;
    this.mutate(
      this.facade.returnToSupplier(context.order, input, context.idempotencyKey),
      'Devolución registrada sin duplicar movimientos.',
      () => this.returning.set(null),
    );
  }

  private syncFrom(params: ParamMap): void {
    const page = Number(params.get('page'));
    const query = {
      q: params.get('q') ?? undefined,
      page: Number.isInteger(page) && page > 0 ? page : 1,
      pageSize: 20,
    };
    this.filters.controls.q.setValue(query.q ?? '', { emitEvent: false });
    const key = JSON.stringify(query);
    if (key !== this.listKey) {
      this.listKey = key;
      this.loadOrders(query);
    }
    const id = params.get('order') ?? '';
    if (id !== this.detailKey) {
      this.detailKey = id;
      this.selected.set(null);
      if (id) this.loadOrder(id);
    }
    if (params.get('action') === 'nueva' && this.canManage()) {
      this.openCreate();
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { action: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  private loadOrders(query: { q?: string; page: number; pageSize: number }): void {
    const revision = ++this.listRevision;
    this.loading.set(true);
    this.facade
      .list(query)
      .pipe(finalize(() => revision === this.listRevision && this.loading.set(false)))
      .subscribe({
        next: (page) => revision === this.listRevision && this.page.set(page),
        error: (error: unknown) =>
          revision === this.listRevision && this.error.set(this.messageFor(error)),
      });
  }

  private loadOrder(id: string): void {
    const revision = ++this.detailRevision;
    this.detailLoading.set(true);
    this.facade
      .get(id)
      .pipe(finalize(() => revision === this.detailRevision && this.detailLoading.set(false)))
      .subscribe({
        next: (order) => revision === this.detailRevision && this.selected.set(order),
        error: (error: unknown) =>
          revision === this.detailRevision && this.error.set(this.messageFor(error)),
      });
  }

  private loadReferences(): void {
    forkJoin({
      suppliers: this.facade.listSuppliers(),
      locations: this.facade.listLocations(),
    }).subscribe({
      next: ({ suppliers, locations }) => {
        this.suppliers.set(suppliers);
        this.locations.set(locations);
      },
      error: (error: unknown) => this.error.set(this.messageFor(error)),
    });
  }

  private mutate(
    request: import('rxjs').Observable<PurchaseOrder>,
    message: string,
    close: (order: PurchaseOrder) => void,
  ): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (order) => {
        close(order);
        this.selected.set(order);
        this.notice.set(message);
        this.listKey = '';
        this.syncFrom(this.route.snapshot.queryParamMap);
      },
      error: (error: unknown) => this.error.set(this.messageFor(error)),
    });
  }

  private navigateTo(orderId: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { order: orderId },
      queryParamsHandling: 'merge',
    });
  }

  private clearMessages(): void {
    this.error.set(null);
    this.notice.set(null);
  }

  private idempotencyKey(): string {
    return `web-${crypto.randomUUID()}`;
  }

  private messageFor(error: unknown): string {
    if (!(error instanceof ApiError)) return 'No fue posible actualizar las órdenes de compra.';
    const messages: Record<string, string> = {
      INVALID_PURCHASE_ORDER_SUPPLIER: 'El proveedor no está activo o no pertenece a esta empresa.',
      INVALID_PURCHASE_ORDER_LINE: 'Un producto no corresponde al proveedor seleccionado.',
      INVALID_PURCHASE_ORDER_CURRENCY: 'La moneda no coincide con el costo vigente de una línea.',
      DUPLICATE_PURCHASE_ORDER_LINE: 'Cada producto sólo puede aparecer una vez.',
      PURCHASE_ORDER_VERSION_CONFLICT: 'La orden cambió. Vuelve a abrirla antes de continuar.',
      PURCHASE_ORDER_STATE_CONFLICT: 'El estado actual ya no permite esta operación.',
      INVALID_PURCHASE_RECEIPT: 'La recepción contiene líneas o cantidades inválidas.',
      INVALID_PURCHASE_RECEIPT_LOCATION: 'La ubicación no pertenece a la bodega activa.',
      PURCHASE_RECEIPT_OVERAGE_PERMISSION_REQUIRED: 'No tienes permiso para recibir sobrantes.',
      PURCHASE_RECEIPT_OVERAGE_REASON_REQUIRED: 'Explica la discrepancia de cantidad recibida.',
      INVENTORY_LOT_REQUIRED: 'Indica el lote para cada producto que lo controla.',
      INVENTORY_LOT_EXPIRATION_REQUIRED: 'Indica la caducidad del lote.',
      INVENTORY_SERIALS_REQUIRED: 'Indica todas las series requeridas por la cantidad.',
      INVALID_PURCHASE_RETURN: 'La devolución no corresponde a esta recepción.',
      PURCHASE_RETURN_QUANTITY_EXCEEDED: 'La devolución supera la cantidad recibida disponible.',
      INSUFFICIENT_PURCHASE_RETURN_STOCK: 'No hay stock suficiente en la ubicación de recepción.',
      INVENTORY_FIFO_LAYER_SHORTAGE: 'No hay capas de costo suficientes para devolver.',
    };
    return (error.code && messages[error.code]) || error.message;
  }
}
