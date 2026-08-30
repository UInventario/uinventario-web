import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../../core/api/api-error';
import { SessionState } from '../../../../../core/session/session-state';
import { writePendingSuspendedSale } from '../../../pos/application/pos-cart.persistence';
import { PosCartLine } from '../../../pos/domain/pos.models';
import { SalesLifecycleFacade } from '../../application/sales-lifecycle.facade';
import { SuspendedSale, SuspendedSaleResume } from '../../domain/sales-lifecycle.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe],
  selector: 'ui-suspended-sales-panel',
  styleUrls: ['./suspended-sales-panel.scss', './suspended-sales-responsive.scss'],
  templateUrl: './suspended-sales-panel.html',
})
export class SuspendedSalesPanel implements OnInit {
  private readonly facade = inject(SalesLifecycleFacade);
  private readonly sessions = inject(SessionState);
  private readonly router = inject(Router);

  protected readonly sales = signal<readonly SuspendedSale[]>([]);
  protected readonly loading = signal(true);
  protected readonly busyId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly resumePreview = signal<SuspendedSaleResume | null>(null);
  protected readonly cancelCandidate = signal<SuspendedSale | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected resume(sale: SuspendedSale): void {
    if (this.busyId()) return;
    this.busyId.set(sale.id);
    this.error.set(null);
    this.facade
      .resumeSuspended(sale.id)
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe({
        next: (result) => this.resumePreview.set(result),
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  protected confirmResume(): void {
    const result = this.resumePreview();
    const session = this.sessions.session();
    if (!result?.quote || this.hasBlockingConflict(result)) {
      this.error.set('Esta venta no puede reanudarse hasta resolver los conflictos indicados.');
      return;
    }
    const lines: readonly PosCartLine[] = result.quote.lines.map((line) => ({
      product: {
        ...line.product,
        barcode: null,
        quantityRounding: 'HALF_UP',
        trackLots: false,
        trackSerials: false,
        price: line.unitPrice,
        active: true,
        sellable: true,
      },
      quantity: line.quantity,
    }));
    if (
      !writePendingSuspendedSale(session, {
        id: result.suspendedSale.id,
        customerId: result.suspendedSale.customer?.id ?? null,
        lines,
      })
    ) {
      this.error.set('Selecciona una sucursal, bodega y caja antes de reanudar la venta.');
      return;
    }
    void this.router.navigate(['/ventas/pos']);
  }

  protected cancel(): void {
    const sale = this.cancelCandidate();
    if (!sale || this.busyId()) return;
    this.busyId.set(sale.id);
    this.error.set(null);
    this.facade
      .cancelSuspended(sale.id)
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe({
        next: (updated) => {
          this.sales.update((items) =>
            items.map((item) => (item.id === updated.id ? updated : item)),
          );
          this.cancelCandidate.set(null);
        },
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  protected total(sale: SuspendedSale): number {
    return sale.lines.reduce(
      (sum, line) => sum + Number(line.quantity) * Number(line.unitPriceSnapshot),
      0,
    );
  }

  protected hasBlockingConflict(result: SuspendedSaleResume): boolean {
    return (
      !result.quote ||
      result.conflicts.some(({ code }) =>
        ['INSUFFICIENT_STOCK', 'PRODUCT_NOT_AVAILABLE'].includes(code),
      )
    );
  }

  protected conflictLabel(code: SuspendedSaleResume['conflicts'][number]['code']): string {
    return {
      PRICE_CHANGED: 'El precio cambió',
      AVAILABILITY_CHANGED: 'La existencia cambió',
      INSUFFICIENT_STOCK: 'Existencia insuficiente',
      PRODUCT_NOT_AVAILABLE: 'Producto no disponible',
    }[code];
  }

  protected statusLabel(status: SuspendedSale['status']): string {
    return {
      ACTIVE: 'Activa',
      CANCELLED: 'Cancelada',
      RESUMED: 'Completada',
      EXPIRED: 'Vencida',
    }[status];
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.facade
      .listSuspended()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (sales) => this.sales.set(sales),
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  private messageFor(error: unknown): string {
    if (!(error instanceof ApiError)) return 'No fue posible operar la venta suspendida.';
    const messages: Record<string, string> = {
      SUSPENDED_SALE_EXPIRED: 'La venta ya venció y no puede reanudarse.',
      SUSPENDED_SALE_NOT_ACTIVE: 'La venta ya fue cancelada o completada.',
      INSUFFICIENT_STOCK: 'Ya no existe inventario suficiente.',
    };
    return messages[error.code] ?? error.message;
  }
}
