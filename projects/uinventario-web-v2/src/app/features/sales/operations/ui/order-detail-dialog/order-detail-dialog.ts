import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import {
  CustomerOrder,
  CustomerOrderPriority,
  FulfillmentStatus,
  OrderTransition,
  ShippingContract,
  ShippingQuote,
} from '../../domain/order.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  selector: 'ui-order-detail-dialog',
  styleUrls: ['../operations-dialog.scss', './order-detail-dialog.scss'],
  templateUrl: './order-detail-dialog.html',
})
export class OrderDetailDialog {
  readonly order = input.required<CustomerOrder>();
  readonly contract = input<ShippingContract | null>(null);
  readonly shippingQuote = input<ShippingQuote | null>(null);
  readonly busy = input(false);
  readonly apiError = input<string | null>(null);
  readonly closed = output<void>();
  readonly transition = output<{ readonly action: OrderTransition; readonly reason?: string }>();
  readonly quoteShipping = output<void>();
  readonly pollShipping = output<'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'TIMEOUT'>();
  readonly cancelShipping = output<'SUCCESS' | 'TIMEOUT'>();
  protected readonly cancelling = signal(false);
  protected readonly cancelReason = signal('');
  protected readonly localError = signal<string | null>(null);

  protected cancelOrder(): void {
    const reason = this.cancelReason().replace(/\s+/g, ' ').trim();
    if (reason.length < 3) {
      this.localError.set('Indica un motivo de cancelación.');
      return;
    }
    this.transition.emit({ action: 'cancel', reason });
  }

  protected canCancel(): boolean {
    return !['DELIVERED', 'CANCELLED'].includes(this.order().status);
  }

  protected canDeliver(): boolean {
    const order = this.order();
    return (
      order.status === 'READY' &&
      (order.fulfillment.method === 'PICKUP' ||
        order.fulfillment.carrier?.trackingStatus === 'DELIVERED')
    );
  }

  protected statusLabel(): string {
    return {
      DRAFT: 'Borrador',
      CONFIRMED: 'Confirmado',
      PREPARING: 'Preparando',
      READY: 'Listo',
      DELIVERED: 'Entregado',
      CANCELLED: 'Cancelado',
    }[this.order().status];
  }

  protected priorityLabel(priority: CustomerOrderPriority): string {
    return { LOW: 'Baja', NORMAL: 'Normal', HIGH: 'Alta', URGENT: 'Urgente' }[priority];
  }

  protected fulfillmentLabel(status: FulfillmentStatus): string {
    return {
      PENDING: 'Pendiente',
      PREPARING: 'Preparando',
      READY: 'Listo',
      RETRYABLE_FAILURE: 'Reintento necesario',
      DISPATCHED: 'Despachado',
      DELIVERED: 'Entregado',
      CANCELLED: 'Cancelado',
    }[status];
  }

  protected trackingLabel(status: string | null): string {
    if (!status) return 'Pendiente';
    return (
      {
        LABEL_READY: 'Guía creada',
        IN_TRANSIT: 'En tránsito',
        OUT_FOR_DELIVERY: 'En reparto',
        DELIVERED: 'Entregado',
        EXCEPTION: 'Incidencia',
        CANCELLED: 'Cancelado',
      }[status] ?? status
    );
  }
}
