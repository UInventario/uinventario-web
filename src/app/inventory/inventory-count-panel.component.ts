import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { ProductApiService, ProductData } from '../catalog/product-api.service';
import { ProductCodeScannerComponent } from '../catalog/product-code-scanner.component';
import {
  InventoryApiService,
  InventoryCountSessionData,
  InventoryLocationData,
} from './inventory-api.service';

const QUANTITY_PATTERN = /^(0|[1-9]\d{0,11})(\.\d{1,3})?$/;

@Component({
  selector: 'app-inventory-count-panel',
  imports: [ReactiveFormsModule, ProductCodeScannerComponent],
  templateUrl: './inventory-count-panel.component.html',
  styleUrl: './inventory-count-panel.component.scss',
})
export class InventoryCountPanelComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly inventory = inject(InventoryApiService);
  private readonly productsApi = inject(ProductApiService);
  private pendingCreationKey: string | null = null;

  readonly canApprove = input(false);
  readonly canCount = input(false);
  readonly closed = output<void>();
  protected readonly locations = signal<InventoryLocationData[]>([]);
  protected readonly sessions = signal<InventoryCountSessionData[]>([]);
  protected readonly selectedProducts = signal<ProductData[]>([]);
  protected readonly productResults = signal<ProductData[]>([]);
  protected readonly activeSession = signal<InventoryCountSessionData | null>(null);
  protected readonly quantities = signal<Record<string, string>>({});
  protected readonly loading = signal(true);
  protected readonly searching = signal(false);
  protected readonly savingProductId = signal<string | null>(null);
  protected readonly creating = signal(false);
  protected readonly closing = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  protected readonly createForm = this.formBuilder.nonNullable.group({
    locationId: ['', Validators.required],
    blind: [true],
  });
  protected readonly searchForm = this.formBuilder.nonNullable.group({ q: [''] });
  protected readonly closeForm = this.formBuilder.nonNullable.group({
    reason: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(160)]],
    reference: ['', [Validators.required, Validators.maxLength(120)]],
  });
  protected readonly readyToClose = computed(
    () => this.activeSession()?.lines.every((line) => line.countedQuantity !== null) ?? false,
  );

  ngOnInit(): void {
    this.loadWorkspace();
  }

  protected searchProducts(): void {
    if (this.searching()) return;
    this.searching.set(true);
    this.error.set(null);
    this.productsApi
      .list({ q: this.searchForm.controls.q.value.trim(), status: 'ACTIVE', page: 1, pageSize: 25 })
      .pipe(finalize(() => this.searching.set(false)))
      .subscribe({
        next: ({ data }) => this.productResults.set(data),
        error: (error: HttpErrorResponse) => this.error.set(this.messageFor(error)),
      });
  }

  protected addProduct(product: ProductData): void {
    if (this.activeSession() || this.selectedProducts().some(({ id }) => id === product.id)) return;
    this.selectedProducts.update((current) => [...current, product]);
  }

  protected scannedProduct(product: ProductData): void {
    const session = this.activeSession();
    if (!session) {
      this.addProduct(product);
      return;
    }
    const line = session.lines.find(({ product: current }) => current.id === product.id);
    if (!line) {
      this.error.set('El producto escaneado no pertenece al alcance fijado de esta sesión.');
      return;
    }
    this.error.set(null);
    this.success.set(`Producto localizado: ${line.product.name}. Captura su existencia física.`);
  }

  protected removeProduct(productId: string): void {
    this.selectedProducts.update((current) => current.filter(({ id }) => id !== productId));
  }

  protected createSession(): void {
    if (
      !this.canCount() ||
      this.createForm.invalid ||
      this.selectedProducts().length === 0 ||
      this.creating()
    ) {
      this.createForm.markAllAsTouched();
      if (this.selectedProducts().length === 0) this.error.set('Agrega al menos un producto.');
      return;
    }
    const key = this.pendingCreationKey ?? `web-count-${globalThis.crypto.randomUUID()}`;
    this.pendingCreationKey = key;
    this.creating.set(true);
    this.error.set(null);
    this.success.set(null);
    this.inventory
      .createCountSession(
        {
          locationId: this.createForm.controls.locationId.value,
          productIds: this.selectedProducts().map(({ id }) => id),
          blind: this.createForm.controls.blind.value,
        },
        key,
      )
      .pipe(finalize(() => this.creating.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.pendingCreationKey = null;
          this.activate(data);
          this.sessions.update((current) => [data, ...current]);
          this.success.set('Sesión abierta. Captura cada existencia física.');
        },
        error: (error: HttpErrorResponse) => {
          if (error.status > 0 && error.status < 500) this.pendingCreationKey = null;
          this.error.set(this.messageFor(error));
        },
      });
  }

  protected resume(session: InventoryCountSessionData): void {
    this.activate(session);
    this.error.set(null);
    this.success.set(null);
  }

  protected leaveSession(): void {
    this.activeSession.set(null);
    this.quantities.set({});
  }

  protected updateQuantity(productId: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.quantities.update((current) => ({ ...current, [productId]: value }));
  }

  protected record(line: InventoryCountSessionData['lines'][number]): void {
    const session = this.activeSession();
    const countedQuantity = this.quantities()[line.product.id]?.trim();
    if (
      !this.canCount() ||
      !session ||
      !countedQuantity ||
      !QUANTITY_PATTERN.test(countedQuantity)
    ) {
      this.error.set('La cantidad debe ser cero o positiva y tener hasta 3 decimales.');
      return;
    }
    this.savingProductId.set(line.product.id);
    this.error.set(null);
    this.success.set(null);
    this.inventory
      .recordCount(session.id, line.product.id, {
        countedQuantity,
        expectedAttempt: line.attemptCount,
      })
      .pipe(finalize(() => this.savingProductId.set(null)))
      .subscribe({
        next: ({ data }) => {
          this.replaceSession(data);
          const updated = data.lines.find(({ product }) => product.id === line.product.id)!;
          this.success.set(
            updated.attemptCount > 1
              ? 'Reconteo registrado con responsable.'
              : 'Conteo registrado.',
          );
        },
        error: (error: HttpErrorResponse) => {
          this.error.set(this.messageFor(error));
          if (
            (error.error as { code?: string } | null)?.code === 'INVENTORY_COUNT_ATTEMPT_CONFLICT'
          ) {
            this.inventory.getCountSession(session.id).subscribe({
              next: ({ data }) => this.replaceSession(data),
            });
          }
        },
      });
  }

  protected closeSession(): void {
    const session = this.activeSession();
    if (
      !session ||
      !this.canApprove() ||
      !this.readyToClose() ||
      this.closeForm.invalid ||
      this.closing()
    ) {
      this.closeForm.markAllAsTouched();
      return;
    }
    this.closing.set(true);
    this.error.set(null);
    this.success.set(null);
    this.inventory
      .closeCountSession(session.id, this.closeForm.getRawValue())
      .pipe(finalize(() => this.closing.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.replaceSession(data);
          this.closeForm.reset({ reason: '', reference: '' });
          this.success.set('Conteo cerrado y diferencias aplicadas al inventario.');
          this.closed.emit();
        },
        error: (error: HttpErrorResponse) => this.error.set(this.messageFor(error)),
      });
  }

  private loadWorkspace(): void {
    this.loading.set(true);
    forkJoin({
      locations: this.inventory.listLocations(),
      sessions: this.inventory.listCountSessions(),
      products: this.productsApi.list({ status: 'ACTIVE', page: 1, pageSize: 25 }),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ locations, sessions, products }) => {
          this.locations.set(locations.data);
          this.sessions.set(sessions.data);
          this.productResults.set(products.data);
          if (locations.data[0]) this.createForm.controls.locationId.setValue(locations.data[0].id);
        },
        error: (error: HttpErrorResponse) => this.error.set(this.messageFor(error)),
      });
  }

  private activate(session: InventoryCountSessionData): void {
    this.activeSession.set(session);
    this.quantities.set(
      Object.fromEntries(
        session.lines.map((line) => [line.product.id, line.countedQuantity ?? '']),
      ),
    );
  }

  private replaceSession(session: InventoryCountSessionData): void {
    this.activate(session);
    this.sessions.update((current) => [session, ...current.filter(({ id }) => id !== session.id)]);
  }

  private messageFor(error: HttpErrorResponse): string {
    const body = error.error as { code?: string; message?: string } | null;
    if (body?.code === 'INVENTORY_COUNT_ATTEMPT_CONFLICT') {
      return 'Otro usuario registró este producto. La sesión se actualizó para continuar.';
    }
    if (body?.code === 'INVENTORY_COUNT_STOCK_CHANGED') {
      return 'El stock cambió desde la apertura. Inicia una sesión nueva para no sobrescribirlo.';
    }
    if (body?.code === 'INVENTORY_COUNT_SESSION_INCOMPLETE') {
      return 'Captura todos los productos antes de cerrar.';
    }
    if (body?.message && typeof body.message === 'string') return body.message;
    if (error.status === 0) return 'No fue posible conectar con inventario.';
    return 'No fue posible procesar el conteo físico.';
  }
}
