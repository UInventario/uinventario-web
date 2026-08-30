import { OperationalPermission } from '../domain/access.models';

export type PermissionRisk = 'STANDARD' | 'ELEVATED' | 'CRITICAL';

export interface PermissionOption {
  readonly id: OperationalPermission;
  readonly label: string;
  readonly description: string;
  readonly risk: PermissionRisk;
}

export interface PermissionGroup {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly permissions: readonly PermissionOption[];
}

export const PERMISSION_GROUPS: readonly PermissionGroup[] = [
  {
    id: 'catalog',
    label: 'Catálogo',
    icon: 'pi pi-box',
    permissions: [
      option(
        'PRODUCTS_MANAGE',
        'Gestionar productos',
        'Crea y modifica productos, precios y clasificación.',
        'ELEVATED',
      ),
    ],
  },
  {
    id: 'inventory',
    label: 'Inventario',
    icon: 'pi pi-warehouse',
    permissions: [
      option('INVENTORY_VIEW', 'Consultar inventario', 'Ve existencias y movimientos.', 'STANDARD'),
      option(
        'INVENTORY_ADJUST',
        'Ajustar existencias',
        'Registra entradas, salidas y ajustes.',
        'ELEVATED',
      ),
      option(
        'INVENTORY_TRANSFER',
        'Transferir inventario',
        'Mueve existencias entre ubicaciones.',
        'ELEVATED',
      ),
      option('INVENTORY_COUNT', 'Realizar conteos', 'Abre y captura conteos físicos.', 'STANDARD'),
      option(
        'INVENTORY_APPROVE',
        'Aprobar conteos',
        'Aplica diferencias al inventario real.',
        'CRITICAL',
      ),
      option(
        'INVENTORY_VALUATION_MANAGE',
        'Gestionar valorización',
        'Consulta costos y cambia políticas de valor.',
        'CRITICAL',
      ),
      option(
        'INVENTORY_EXPIRED_STOCK_OVERRIDE',
        'Autorizar stock vencido',
        'Permite excepciones sobre productos vencidos.',
        'CRITICAL',
      ),
    ],
  },
  {
    id: 'sales',
    label: 'Ventas',
    icon: 'pi pi-shopping-cart',
    permissions: [
      option('SALES_MANAGE', 'Operar ventas', 'Crea y consulta ventas.', 'STANDARD'),
      option('SALES_VOID', 'Anular ventas', 'Anula operaciones ya registradas.', 'CRITICAL'),
      option('SALES_RETURN', 'Procesar devoluciones', 'Devuelve productos y pagos.', 'ELEVATED'),
      option(
        'SALES_DISCOUNT',
        'Aplicar descuentos',
        'Modifica el total mediante descuentos.',
        'ELEVATED',
      ),
      option(
        'SALES_PRICE_OVERRIDE',
        'Cambiar precios',
        'Sobrescribe el precio de catálogo.',
        'CRITICAL',
      ),
      option('SALES_CREDIT', 'Vender a crédito', 'Genera saldos por cobrar.', 'CRITICAL'),
      option('SALE_REPRINT', 'Reimprimir comprobantes', 'Genera copias de tickets.', 'STANDARD'),
    ],
  },
  {
    id: 'cash',
    label: 'Caja',
    icon: 'pi pi-wallet',
    permissions: [
      option(
        'CASH_DRAWER_OPEN',
        'Abrir cajón',
        'Acciona la apertura manual del cajón.',
        'ELEVATED',
      ),
      option('CASH_REGISTER_OPEN', 'Abrir turno', 'Inicia la operación de una caja.', 'STANDARD'),
      option('CASH_REGISTER_CLOSE', 'Cerrar turno', 'Realiza cierre y arqueo.', 'ELEVATED'),
      option(
        'CASH_REGISTER_MOVE',
        'Registrar movimientos',
        'Registra ingresos y retiros de efectivo.',
        'ELEVATED',
      ),
    ],
  },
  {
    id: 'purchases',
    label: 'Compras',
    icon: 'pi pi-truck',
    permissions: [
      option(
        'SUPPLIERS_MANAGE',
        'Gestionar proveedores',
        'Mantiene datos de proveedores.',
        'STANDARD',
      ),
      option(
        'PURCHASE_ORDERS_MANAGE',
        'Gestionar órdenes',
        'Crea y actualiza órdenes de compra.',
        'ELEVATED',
      ),
      option(
        'PURCHASE_ORDERS_APPROVE',
        'Aprobar órdenes',
        'Compromete compras a proveedores.',
        'CRITICAL',
      ),
      option(
        'PURCHASE_RECEIPTS_OVERAGE',
        'Autorizar excedentes',
        'Recibe más cantidad que la ordenada.',
        'CRITICAL',
      ),
    ],
  },
  {
    id: 'governance',
    label: 'Control',
    icon: 'pi pi-shield',
    permissions: [
      option(
        'AUDIT_VIEW',
        'Consultar auditoría',
        'Ve actividad sensible de la empresa.',
        'ELEVATED',
      ),
      option('AUDIT_EXPORT', 'Exportar auditoría', 'Descarga evidencia operativa.', 'CRITICAL'),
      option(
        'PRIVACY_MANAGE',
        'Gestionar privacidad',
        'Atiende solicitudes sobre datos personales.',
        'CRITICAL',
      ),
      option(
        'NOTIFICATIONS_VIEW',
        'Consultar alertas',
        'Ve alertas y notificaciones operativas.',
        'STANDARD',
      ),
      option(
        'NOTIFICATIONS_MANAGE',
        'Configurar alertas',
        'Cambia reglas y destinatarios.',
        'ELEVATED',
      ),
    ],
  },
];

export const PERMISSION_OPTIONS = PERMISSION_GROUPS.flatMap((group) => group.permissions);

const LABELS = new Map(PERMISSION_OPTIONS.map((permission) => [permission.id, permission.label]));

export function permissionLabel(permission: OperationalPermission): string {
  return LABELS.get(permission) ?? permission;
}

function option(
  id: OperationalPermission,
  label: string,
  description: string,
  risk: PermissionRisk,
): PermissionOption {
  return { id, label, description, risk };
}
