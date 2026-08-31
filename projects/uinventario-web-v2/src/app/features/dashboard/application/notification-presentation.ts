import { NotificationEventType } from '../domain/dashboard.models';

export const NOTIFICATION_LABELS: Readonly<Record<NotificationEventType, string>> = {
  STOCK_LOW: 'Stock bajo',
  LOT_EXPIRING: 'Lotes por vencer',
  PURCHASE_PENDING: 'Compras pendientes',
  CASH_DIFFERENCE: 'Diferencias de caja',
  SYNC_FAILED: 'Sincronización',
  OPERATION_FAILED: 'Operaciones con error',
};

export interface NotificationDestination {
  readonly label: string;
  readonly commands: readonly string[];
  readonly queryParams?: Readonly<Record<string, string>>;
}

export function notificationDestination(eventType: NotificationEventType): NotificationDestination {
  return {
    STOCK_LOW: {
      label: 'Revisar alertas de inventario',
      commands: ['/inventario/control'],
      queryParams: { view: 'alerts' },
    },
    LOT_EXPIRING: { label: 'Revisar productos y lotes', commands: ['/catalogo'] },
    PURCHASE_PENDING: { label: 'Abrir órdenes de compra', commands: ['/compras/ordenes'] },
    CASH_DIFFERENCE: { label: 'Abrir reporte de caja', commands: ['/reportes/caja'] },
    SYNC_FAILED: {
      label: 'Ver detalle de sincronización',
      commands: ['/dashboard/notificaciones'],
      queryParams: { type: 'SYNC_FAILED' },
    },
    OPERATION_FAILED: { label: 'Abrir actividad', commands: ['/reportes/actividad'] },
  }[eventType];
}
