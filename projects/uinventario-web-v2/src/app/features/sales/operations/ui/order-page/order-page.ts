import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Observable, finalize, forkJoin } from 'rxjs';
import { SalesOperationsFacade } from '../../application/sales-operations.facade';
import { salesOperationError } from '../../application/operations-error';
import { OperationOptions } from '../../domain/operations.models';
import {
  CreateCustomerOrderInput,
  CustomerOrder,
  CustomerOrderPage,
  CustomerOrderPriority,
  CustomerOrderStatus,
  OrderTransition,
  ShippingContract,
  ShippingQuote,
} from '../../domain/order.models';
import { OrderDetailDialog } from '../order-detail-dialog/order-detail-dialog';
import { OrderEditorDialog } from '../order-editor-dialog/order-editor-dialog';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, OrderDetailDialog, OrderEditorDialog],
  selector: 'ui-order-page',
  styleUrls: ['../operations-page.scss'],
  templateUrl: './order-page.html',
})
export class OrderPageComponent implements OnInit {
  private readonly facade = inject(SalesOperationsFacade);
  protected readonly options = signal<OperationOptions | null>(null);
  protected readonly result = signal<CustomerOrderPage | null>(null);
  protected readonly contract = signal<ShippingContract | null>(null);
  protected readonly selected = signal<CustomerOrder | null>(null);
  protected readonly shippingQuote = signal<ShippingQuote | null>(null);
  protected readonly status = signal<CustomerOrderStatus | ''>('');
  protected readonly priority = signal<CustomerOrderPriority | ''>('');
  protected readonly editorOpen = signal(false);
  protected readonly loading = signal(true);
  protected readonly acting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly detailError = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  ngOnInit(): void {
    forkJoin({
      options: this.facade.options(),
      orders: this.facade.orders(undefined, undefined, 1),
      contract: this.facade.shippingContract(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ options, orders, contract }) => {
          this.options.set(options);
          this.result.set(orders);
          this.contract.set(contract);
        },
        error: (error: unknown) =>
          this.error.set(salesOperationError(error, 'No fue posible cargar los pedidos.')),
      });
  }

  protected openCreate(): void {
    this.clearMessages();
    this.editorOpen.set(true);
  }

  protected create(input: CreateCustomerOrderInput): void {
    if (this.acting()) return;
    this.acting.set(true);
    this.error.set(null);
    this.facade
      .createOrder(input)
      .pipe(finalize(() => this.acting.set(false)))
      .subscribe({
        next: (order) => {
          this.editorOpen.set(false);
          this.selected.set(order);
          this.notice.set(
            `Pedido ${order.orderNumber} creado. Confírmalo para reservar existencias.`,
          );
          this.load(1);
        },
        error: (error: unknown) =>
          this.error.set(salesOperationError(error, 'No fue posible crear el pedido.')),
      });
  }

  protected openDetail(order: CustomerOrder): void {
    if (this.acting()) return;
    this.acting.set(true);
    this.detailError.set(null);
    this.shippingQuote.set(null);
    this.facade
      .order(order.id)
      .pipe(finalize(() => this.acting.set(false)))
      .subscribe({
        next: (current) => this.selected.set(current),
        error: (error: unknown) =>
          this.error.set(salesOperationError(error, 'No fue posible abrir el pedido.')),
      });
  }

  protected transition(event: {
    readonly action: OrderTransition;
    readonly reason?: string;
  }): void {
    const order = this.selected();
    if (!order || this.acting()) return;
    this.acting.set(true);
    this.detailError.set(null);
    this.facade
      .transitionOrder(order.id, event.action, order.version, event.reason)
      .pipe(finalize(() => this.acting.set(false)))
      .subscribe({
        next: (updated) => this.afterOrderAction(updated, actionNotice(event.action, updated)),
        error: (error: unknown) => {
          this.detailError.set(salesOperationError(error, 'No fue posible actualizar el pedido.'));
          this.refreshSelected(order.id);
        },
      });
  }

  protected quoteShipping(): void {
    const order = this.selected();
    if (!order || this.acting()) return;
    this.runDetailAction(
      this.facade.quoteShipping(order.id),
      (quote) => this.shippingQuote.set(quote),
      'No fue posible cotizar el despacho.',
    );
  }

  protected pollShipping(
    scenario: 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'TIMEOUT',
  ): void {
    const order = this.selected();
    if (!order || this.acting()) return;
    this.runDetailAction(
      this.facade.pollShipping(order.id, scenario),
      (updated) => this.afterOrderAction(updated, 'Seguimiento del despacho actualizado.'),
      'No fue posible consultar el despacho.',
    );
  }

  protected cancelShipping(scenario: 'SUCCESS' | 'TIMEOUT'): void {
    const order = this.selected();
    if (!order || this.acting()) return;
    this.runDetailAction(
      this.facade.cancelShipping(order.id, scenario),
      (updated) =>
        this.afterOrderAction(updated, 'Despacho cancelado; el pedido sigue disponible.'),
      'No fue posible cancelar el despacho.',
    );
  }

  protected filterStatus(value: string): void {
    this.status.set(value as CustomerOrderStatus | '');
    this.load(1);
  }

  protected filterPriority(value: string): void {
    this.priority.set(value as CustomerOrderPriority | '');
    this.load(1);
  }

  protected goToPage(page: number): void {
    this.load(page);
  }

  protected statusLabel(status: CustomerOrderStatus): string {
    return {
      DRAFT: 'Borrador',
      CONFIRMED: 'Confirmado',
      PREPARING: 'Preparando',
      READY: 'Listo',
      DELIVERED: 'Entregado',
      CANCELLED: 'Cancelado',
    }[status];
  }

  protected priorityLabel(priority: CustomerOrderPriority): string {
    return { LOW: 'Baja', NORMAL: 'Normal', HIGH: 'Alta', URGENT: 'Urgente' }[priority];
  }

  private load(page: number): void {
    this.loading.set(true);
    this.facade
      .orders(this.status() || undefined, this.priority() || undefined, page)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => this.result.set(result),
        error: (error: unknown) =>
          this.error.set(salesOperationError(error, 'No fue posible actualizar los pedidos.')),
      });
  }

  private runDetailAction<T>(
    request: Observable<T>,
    next: (value: T) => void,
    fallback: string,
  ): void {
    this.acting.set(true);
    this.detailError.set(null);
    request.pipe(finalize(() => this.acting.set(false))).subscribe({
      next,
      error: (error: unknown) => this.detailError.set(salesOperationError(error, fallback)),
    });
  }

  private afterOrderAction(order: CustomerOrder, notice: string): void {
    this.selected.set(order);
    this.notice.set(notice);
    this.load(this.result()?.pagination.page ?? 1);
  }

  private refreshSelected(id: string): void {
    this.facade.order(id).subscribe({ next: (order) => this.selected.set(order) });
  }

  private clearMessages(): void {
    this.error.set(null);
    this.detailError.set(null);
    this.notice.set(null);
  }
}

function actionNotice(action: OrderTransition, order: CustomerOrder): string {
  const messages: Record<OrderTransition, string> = {
    confirm: `Existencias reservadas para ${order.orderNumber}.`,
    prepare: `Preparación iniciada por ${order.fulfillment.responsible.preparation?.email ?? 'el usuario actual'}.`,
    ready: `${order.orderNumber} está listo para entrega.`,
    dispatch: `Despacho iniciado con rastreo ${order.fulfillment.carrier?.trackingReference ?? 'pendiente'}.`,
    deliver: `${order.orderNumber} entregado y convertido en venta ${order.sale?.receiptNumber ?? ''}.`,
    cancel: `${order.orderNumber} cancelado y sus existencias liberadas.`,
  };
  return messages[action];
}
