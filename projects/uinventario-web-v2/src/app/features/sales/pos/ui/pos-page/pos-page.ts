import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { ApiError } from '../../../../../core/api/api-error';
import { AuthorizationService } from '../../../../../core/authorization/authorization.service';
import { SessionState } from '../../../../../core/session/session-state';
import { PosCartStore } from '../../application/pos-cart.store';
import {
  PendingSuspendedSale,
  clearPendingSuspendedSale,
  readPendingSuspendedSale,
} from '../../application/pos-cart.persistence';
import { PosFacade } from '../../application/pos.facade';
import {
  CashRegisterShift,
  PosCartLine,
  PosCartQuote,
  PosCartRequest,
  PosProduct,
  PosProductPage,
  PosSale,
} from '../../domain/pos.models';
import { PosCheckoutDialog } from '../pos-checkout-dialog/pos-checkout-dialog';
import { PosLineDialog } from '../pos-line-dialog/pos-line-dialog';
import { PosScannerDialog } from '../pos-scanner-dialog/pos-scanner-dialog';
import { PosSuspendDialog } from '../pos-suspend-dialog/pos-suspend-dialog';

interface QuoteState {
  readonly quote: PosCartQuote | null;
  readonly error: string | null;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PosCheckoutDialog,
    PosLineDialog,
    PosScannerDialog,
    PosSuspendDialog,
    ReactiveFormsModule,
    RouterLink,
  ],
  selector: 'ui-pos-page',
  styleUrls: ['./pos-page.scss', './pos-cart.scss', './pos-resumed.scss', './pos-responsive.scss'],
  templateUrl: './pos-page.html',
})
export class PosPage implements OnInit {
  private readonly facade = inject(PosFacade);
  private readonly authorization = inject(AuthorizationService);
  private readonly sessions = inject(SessionState);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchRequests = new Subject<string>();
  private readonly quoteRequests = new Subject<readonly PosCartLine[]>();
  private readonly searchInput = viewChild.required<ElementRef<HTMLInputElement>>('searchInput');

  protected readonly cart = inject(PosCartStore);
  protected readonly searchForm = new FormBuilder().nonNullable.group({ query: [''] });
  protected readonly products = signal<PosProductPage | null>(null);
  protected readonly searching = signal(true);
  protected readonly scanning = signal(false);
  protected readonly scannerOpen = signal(false);
  protected readonly suspendOpen = signal(false);
  protected readonly resumedSale = signal<PendingSuspendedSale | null>(null);
  protected readonly searchError = signal<string | null>(null);
  protected readonly shift = signal<CashRegisterShift | null>(null);
  protected readonly shiftLoaded = signal(false);
  protected readonly quote = signal<PosCartQuote | null>(null);
  protected readonly quoteLoading = signal(false);
  protected readonly quoteError = signal<string | null>(null);
  protected readonly editing = signal<PosCartLine | null>(null);
  protected readonly checkout = signal<{
    readonly quote: PosCartQuote;
    readonly request: PosCartRequest;
  } | null>(null);
  protected readonly canOverridePrice = computed(() =>
    this.authorization.has('SALES_PRICE_OVERRIDE'),
  );
  protected readonly canCredit = computed(() => this.authorization.has('SALES_CREDIT'));
  protected readonly context = computed(() => this.sessions.session()?.context ?? null);
  protected readonly itemCount = computed(() => this.cart.lines().length);

  constructor() {
    this.bindSearch();
    this.bindQuote();
    effect(() => this.quoteRequests.next(this.cart.lines()));
  }

  ngOnInit(): void {
    const resumed = readPendingSuspendedSale(this.sessions.session());
    this.resumedSale.set(resumed);
    if (resumed) this.cart.replace(resumed.lines);
    if (!this.canOverridePrice()) this.cart.stripUnauthorizedOverrides();
    this.loadShift();
    this.searchRequests.next('');
    queueMicrotask(() => this.focusSearch());
  }

  @HostListener('window:keydown', ['$event'])
  protected handleShortcut(event: KeyboardEvent): void {
    if (event.key !== 'F2') return;
    event.preventDefault();
    this.focusSearch();
  }

  protected search(): void {
    this.searchRequests.next(this.searchForm.controls.query.value.trim());
  }

  protected submitSearch(): void {
    const value = this.searchForm.controls.query.value.trim();
    if (!value || this.scanning()) return;
    const exact = this.products()?.products.find(
      (product) =>
        product.sku.toLocaleLowerCase() === value.toLocaleLowerCase() || product.barcode === value,
    );
    if (exact) {
      this.addProduct(exact);
      return;
    }
    this.resolveCode(value);
  }

  protected addProduct(product: PosProduct): void {
    if (this.requiresAdvancedTracking(product)) {
      this.searchError.set(
        'Este producto requiere seleccionar lote o series en una tarea posterior.',
      );
      return;
    }
    this.cart.add(product);
    this.searchError.set(null);
    this.searchForm.controls.query.setValue('');
    this.searchRequests.next('');
    this.focusSearch();
  }

  protected handleCameraCode(code: string): void {
    this.scannerOpen.set(false);
    this.searchForm.controls.query.setValue(code);
    this.resolveCode(code);
  }

  protected saveLine(line: PosCartLine): void {
    const current = this.editing();
    if (!current) return;
    this.cart.update(current.product.id, line);
    this.editing.set(null);
  }

  protected quotedLine(productId: string) {
    return this.quote()?.lines.find((line) => line.product.id === productId) ?? null;
  }

  protected money(value: string | undefined, currency?: string): string {
    if (!value) return '—';
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency || this.quote()?.currency || 'MXN',
    }).format(Number(value));
  }

  protected requiresAdvancedTracking(product: PosProduct): boolean {
    return product.trackLots || product.trackSerials;
  }

  protected openCheckout(): void {
    const quote = this.quote();
    if (!quote || !this.shift() || this.quoteLoading()) return;
    this.checkout.set({
      quote,
      request: this.cartRequest(),
    });
  }

  protected openSuspend(): void {
    if (!this.cart.lines().length) return;
    if (
      this.cart
        .lines()
        .some((line) => line.note || line.manualUnitPrice || line.priceOverrideReason)
    ) {
      this.quoteError.set('Quita notas y precios manuales antes de suspender esta venta.');
      return;
    }
    this.suspendOpen.set(true);
  }

  protected suspended(): void {
    this.releaseSuspendedContext();
    this.cart.clear();
    this.suspendOpen.set(false);
    void this.router.navigate(['/ventas/historial'], { queryParams: { view: 'suspended' } });
  }

  protected saleCompleted(sale: PosSale): void {
    if (sale.status === 'COMPLETED') {
      this.releaseSuspendedContext();
      this.cart.clear();
    }
  }

  protected clearCart(): void {
    this.releaseSuspendedContext();
    this.cart.clear();
  }

  protected removeLine(productId: string): void {
    this.cart.remove(productId);
    if (!this.cart.lines().length) this.releaseSuspendedContext();
  }

  protected closeCheckout(): void {
    this.checkout.set(null);
    queueMicrotask(() => this.focusSearch());
  }

  private bindSearch(): void {
    this.searchRequests
      .pipe(
        debounceTime(160),
        distinctUntilChanged(),
        switchMap((query) => {
          this.searching.set(true);
          this.searchError.set(null);
          return this.facade.searchProducts(query).pipe(
            map((page) => ({ page, error: null as string | null })),
            catchError((error: unknown) =>
              of({ page: null, error: this.messageFor(error, 'No fue posible buscar productos.') }),
            ),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ page, error }) => {
        this.searching.set(false);
        if (page) this.products.set(page);
        this.searchError.set(error);
      });
  }

  private bindQuote(): void {
    this.quoteRequests
      .pipe(
        debounceTime(100),
        switchMap((lines) => {
          if (!lines.length) return of({ quote: null, error: null } satisfies QuoteState);
          if (!this.shift()) {
            return of({
              quote: null,
              error: 'El carrito está guardado. Abre un turno para calcular y cobrar la venta.',
            } satisfies QuoteState);
          }
          this.quoteLoading.set(true);
          return this.facade.quoteCart({ lines: lines.map((line) => this.requestLine(line)) }).pipe(
            map((quote) => ({ quote, error: null }) satisfies QuoteState),
            catchError((error: unknown) =>
              of({
                quote: null,
                error: this.messageFor(error, 'No fue posible recalcular el carrito.'),
              } satisfies QuoteState),
            ),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ quote, error }) => {
        this.quoteLoading.set(false);
        this.quote.set(quote);
        this.quoteError.set(error);
      });
  }

  private resolveCode(code: string): void {
    this.scanning.set(true);
    this.searchError.set(null);
    this.facade
      .resolveCode(code)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (product) => {
          this.scanning.set(false);
          this.addProduct(product);
        },
        error: (error: unknown) => {
          this.scanning.set(false);
          const only = this.products()?.products;
          if (only?.length === 1) this.addProduct(only[0]);
          else this.searchError.set(this.messageFor(error, `No encontramos el código ${code}.`));
        },
      });
  }

  private loadShift(): void {
    this.facade
      .currentShift()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (shift) => {
          this.shift.set(shift);
          this.shiftLoaded.set(true);
          this.quoteRequests.next(this.cart.lines());
        },
        error: () => {
          this.shift.set(null);
          this.shiftLoaded.set(true);
          this.quoteRequests.next(this.cart.lines());
        },
      });
  }

  private requestLine(line: PosCartLine) {
    return {
      productId: line.product.id,
      quantity: line.quantity,
      ...(line.note ? { note: line.note } : {}),
      ...(line.manualUnitPrice && this.canOverridePrice()
        ? {
            manualUnitPrice: line.manualUnitPrice,
            priceOverrideReason: line.priceOverrideReason,
          }
        : {}),
    };
  }

  protected cartRequest(): PosCartRequest {
    const resumed = this.resumedSale();
    return {
      lines: this.cart.lines().map((line) => this.requestLine(line)),
      ...(resumed
        ? {
            suspendedSaleId: resumed.id,
            ...(resumed.customerId ? { customerId: resumed.customerId } : {}),
          }
        : {}),
    };
  }

  private releaseSuspendedContext(): void {
    clearPendingSuspendedSale(this.sessions.session());
    this.resumedSale.set(null);
  }

  private focusSearch(): void {
    const input = this.searchInput().nativeElement;
    input.focus();
    input.select();
  }

  private messageFor(error: unknown, fallback: string): string {
    if (!(error instanceof ApiError)) return fallback;
    const messages: Record<string, string> = {
      INSUFFICIENT_STOCK: 'No hay existencia suficiente para completar este carrito.',
      PRODUCT_NOT_AVAILABLE: 'Uno de los productos ya no está disponible.',
      SALE_PRICE_OVERRIDE_PERMISSION_REQUIRED: 'No tienes permiso para modificar precios.',
      SALE_PRICE_OVERRIDE_REASON_REQUIRED: 'Captura el motivo del precio manual.',
      SALE_PRICE_OVERRIDE_LIMIT_EXCEEDED:
        'El precio manual debe estar entre 50% y 200% del vigente.',
      CASH_REGISTER_SHIFT_REQUIRED: 'Abre un turno en la caja activa antes de cotizar.',
    };
    return messages[error.code] ?? (error.status === 404 ? fallback : error.message);
  }
}
