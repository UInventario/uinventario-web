import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../../core/api/api-error';
import { InventoryTransferFacade } from '../../application/inventory-transfer.facade';
import {
  InventoryTransfer,
  TransferBranch,
  TransferLocation,
  TransferProduct,
  TransferWarehouse,
} from '../../domain/inventory-transfer.models';

interface EditableTransferLine {
  readonly product: TransferProduct;
  readonly sourceLocationId: string;
  readonly destinationLocationId: string;
  readonly quantity: string;
  readonly serials: string;
}

interface DestinationOption {
  readonly branchName: string;
  readonly warehouse: TransferWarehouse;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  selector: 'ui-transfer-create-dialog',
  styleUrl: './transfer-create-dialog.scss',
  templateUrl: './transfer-create-dialog.html',
})
export class TransferCreateDialog implements OnInit {
  private readonly facade = inject(InventoryTransferFacade);
  private readonly formBuilder = inject(FormBuilder);
  private readonly idempotencyKey = `web-transfer-create-${crypto.randomUUID()}`;

  readonly branches = input.required<readonly TransferBranch[]>();
  readonly originWarehouseId = input.required<string>();
  readonly closed = output<void>();
  readonly created = output<InventoryTransfer>();

  protected readonly form = this.formBuilder.nonNullable.group({
    destinationWarehouseId: ['', Validators.required],
    reference: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    reason: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(160)]],
  });
  protected readonly searchForm = this.formBuilder.nonNullable.group({ query: [''] });
  protected readonly products = signal<readonly TransferProduct[]>([]);
  protected readonly lines = signal<readonly EditableTransferLine[]>([]);
  protected readonly searching = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const firstDestination = this.destinations()[0]?.warehouse.id ?? '';
    this.form.controls.destinationWarehouseId.setValue(firstDestination);
    this.searchProducts();
  }

  protected originWarehouse(): TransferWarehouse | null {
    return (
      this.branches()
        .flatMap(({ warehouses }) => warehouses)
        .find(({ id }) => id === this.originWarehouseId()) ?? null
    );
  }

  protected destinations(): readonly DestinationOption[] {
    return this.branches().flatMap((branch) =>
      !branch.active
        ? []
        : branch.warehouses
            .filter(
              (warehouse) =>
                warehouse.active &&
                warehouse.id !== this.originWarehouseId() &&
                warehouse.locations.some(({ active }) => active),
            )
            .map((warehouse) => ({ branchName: branch.name, warehouse })),
    );
  }

  protected sourceLocations(): readonly TransferLocation[] {
    return this.originWarehouse()?.locations.filter(({ active }) => active) ?? [];
  }

  protected destinationLocations(): readonly TransferLocation[] {
    const id = this.form.controls.destinationWarehouseId.value;
    return (
      this.destinations()
        .find(({ warehouse }) => warehouse.id === id)
        ?.warehouse.locations.filter(({ active }) => active) ?? []
    );
  }

  protected destinationChanged(): void {
    const destinationLocationId = this.destinationLocations()[0]?.id ?? '';
    this.lines.update((items) => items.map((line) => ({ ...line, destinationLocationId })));
  }

  protected searchProducts(): void {
    if (this.searching()) return;
    this.searching.set(true);
    this.error.set(null);
    const query = this.searchForm.controls.query.value.trim();
    this.facade
      .products(query || undefined)
      .pipe(finalize(() => this.searching.set(false)))
      .subscribe({
        next: (products) => this.products.set(products),
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  protected addProduct(product: TransferProduct): void {
    if (this.lines().some((line) => line.product.id === product.id)) return;
    const sourceLocationId = this.sourceLocations()[0]?.id ?? '';
    const destinationLocationId = this.destinationLocations()[0]?.id ?? '';
    if (!sourceLocationId || !destinationLocationId) {
      this.error.set('El origen y el destino necesitan al menos una ubicación activa.');
      return;
    }
    this.lines.update((items) => [
      ...items,
      { product, sourceLocationId, destinationLocationId, quantity: '1', serials: '' },
    ]);
  }

  protected remove(productId: string): void {
    this.lines.update((items) => items.filter((line) => line.product.id !== productId));
  }

  protected updateLine(
    productId: string,
    field: 'sourceLocationId' | 'destinationLocationId' | 'quantity' | 'serials',
    value: string,
  ): void {
    this.lines.update((items) =>
      items.map((line) => (line.product.id === productId ? { ...line, [field]: value } : line)),
    );
  }

  protected submit(): void {
    if (this.form.invalid || this.busy()) return;
    this.error.set(null);
    const lines = this.lines();
    if (!lines.length) {
      this.error.set('Agrega al menos un producto a la transferencia.');
      return;
    }
    const quantityPattern = /^(?:[1-9]\d{0,11}(?:\.\d{1,3})?|0\.\d{1,3})$/;
    if (
      lines.some(
        (line) =>
          !line.sourceLocationId ||
          !line.destinationLocationId ||
          !quantityPattern.test(line.quantity.trim()),
      )
    ) {
      this.error.set('Verifica ubicaciones y cantidades; se permiten hasta tres decimales.');
      return;
    }
    const { destinationWarehouseId, reference, reason } = this.form.getRawValue();
    if (destinationWarehouseId === this.originWarehouseId()) {
      this.error.set('La bodega de destino debe ser distinta al origen.');
      return;
    }
    this.busy.set(true);
    this.facade
      .create(
        {
          destinationWarehouseId,
          reference: reference.trim(),
          reason: reason.trim(),
          lines: lines.map((line) => {
            const serialNumbers = this.serials(line.serials);
            return {
              productId: line.product.id,
              sourceLocationId: line.sourceLocationId,
              destinationLocationId: line.destinationLocationId,
              quantity: line.quantity.trim(),
              ...(serialNumbers.length ? { serialNumbers } : {}),
            };
          }),
        },
        this.idempotencyKey,
      )
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (transfer) => this.created.emit(transfer),
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  protected selected(productId: string): boolean {
    return this.lines().some((line) => line.product.id === productId);
  }

  protected close(): void {
    if (!this.busy()) this.closed.emit();
  }

  private serials(value: string): readonly string[] {
    return [
      ...new Set(
        value
          .split(/[\n,]/)
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ];
  }

  private messageFor(error: unknown): string {
    if (!(error instanceof ApiError)) return 'No fue posible crear la transferencia.';
    const messages: Record<string, string> = {
      INVALID_TRANSFER_TARGET: 'Verifica que las bodegas, ubicaciones y productos sigan activos.',
      DUPLICATE_TRANSFER_LINE: 'El mismo producto y trayecto aparece más de una vez.',
      INSUFFICIENT_AVAILABLE_STOCK: 'El origen ya no tiene existencia disponible suficiente.',
      INVENTORY_SERIALS_REQUIRED: 'Captura todas las series requeridas para el producto.',
      IDEMPOTENCY_KEY_REUSED: 'La operación ya fue utilizada con otros datos.',
    };
    return messages[error.code] ?? error.message;
  }
}
