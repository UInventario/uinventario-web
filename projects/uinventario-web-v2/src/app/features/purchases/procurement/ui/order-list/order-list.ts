import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PurchaseOrder, PurchaseOrderPage } from '../../domain/procurement.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'ui-order-list',
  styleUrl: './order-list.scss',
  templateUrl: './order-list.html',
})
export class OrderList {
  readonly page = input<PurchaseOrderPage | null>(null);
  readonly loading = input(false);
  readonly selectedId = input<string | null>(null);
  readonly selected = output<PurchaseOrder>();
  readonly pageChanged = output<number>();

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
