import { ApiError } from '../../../../core/api/api-error';

const COPY: Readonly<Record<string, string>> = {
  PRODUCT_RESERVATION_INSUFFICIENT_STOCK:
    'No hay stock disponible suficiente para crear la reserva.',
  PRODUCT_RESERVATION_STOCK_CONFLICT:
    'El stock cambió mientras se reservaba. Actualiza y vuelve a intentarlo.',
  CUSTOMER_ORDER_RESERVATION_UNAVAILABLE:
    'No se pudo reservar todo el pedido. Revisa las existencias antes de confirmar.',
  CUSTOMER_ORDER_PRICE_CHANGED:
    'El precio del pedido cambió. Crea un pedido nuevo con los valores actuales.',
  CUSTOMER_ORDER_VERSION_CONFLICT:
    'El pedido fue actualizado por otra operación. Se recargará su estado.',
  CUSTOMER_ORDER_STATE_CONFLICT: 'La acción ya no corresponde al estado actual del pedido.',
  CUSTOMER_ORDER_SHIPPING_STATE_CONFLICT:
    'El transportista no permite esa acción en el estado actual.',
  QUOTATION_STOCK_CHANGED: 'La disponibilidad cambió. Revisa las diferencias antes de convertir.',
  QUOTATION_CHANGED: 'Los precios cambiaron. Revisa y acepta las diferencias para continuar.',
  QUOTATION_VERSION_CONFLICT:
    'La cotización fue actualizada por otra operación. Se recargará su estado.',
  QUOTATION_NOT_ACTIVE: 'La cotización ya no está vigente.',
};

export function salesOperationError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  return COPY[error.code] ?? error.message;
}
