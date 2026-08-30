import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import {
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseReceipt,
  PurchaseTransitionAction,
} from '../../domain/procurement.models';

type DetailTab = 'LINES' | 'RECEIPTS' | 'HISTORY';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  selector: 'ui-order-detail',
  styleUrls: ['./order-detail.scss', './order-detail-responsive.scss'],
  templateUrl: './order-detail.html',
})
export class OrderDetail {
  readonly order = input<PurchaseOrder | null>(null);
  readonly loading = input(false);
  readonly canManage = input(false);
  readonly canApprove = input(false);
  readonly editRequested = output<PurchaseOrder>();
  readonly transitionRequested = output<{
    order: PurchaseOrder;
    action: PurchaseTransitionAction;
  }>();
  readonly receiptRequested = output<PurchaseOrder>();
  readonly returnRequested = output<{ order: PurchaseOrder; receipt: PurchaseReceipt }>();
  protected readonly tab = signal<DetailTab>('LINES');

  protected canReceive(order: PurchaseOrder): boolean {
    return (
      this.canManage() &&
      ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED'].includes(order.status)
    );
  }

  protected canCancel(order: PurchaseOrder): boolean {
    return this.canApprove() && ['DRAFT', 'APPROVED', 'SENT'].includes(order.status);
  }

  protected canReturn(receipt: PurchaseReceipt): boolean {
    return this.canManage() && receipt.lines.some((line) => Number(line.returnableQuantity) > 0);
  }

  protected isPositive(value: string): boolean {
    return Number(value) > 0;
  }

  protected lineFor(order: PurchaseOrder, lineId: string): PurchaseOrderLine | undefined {
    return order.lines.find((line) => line.id === lineId);
  }

  protected statusLabel(status: PurchaseOrder['status']): string {
    return {
      DRAFT: 'Borrador',
      APPROVED: 'Aprobada',
      SENT: 'Enviada',
      PARTIALLY_RECEIVED: 'Recepción parcial',
      RECEIVED: 'Recibida',
      CANCELLED: 'Cancelada',
    }[status];
  }
}
