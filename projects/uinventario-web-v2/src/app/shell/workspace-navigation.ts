import { AppPermission } from '../core/authorization/app-permission';
import { RibbonTab } from '../shared/ui/ribbon/ribbon.models';

export type WorkspaceId =
  'dashboard' | 'catalogo' | 'inventario' | 'compras' | 'ventas' | 'reportes' | 'administracion';

export interface WorkspaceNavigationItem {
  readonly id: WorkspaceId;
  readonly label: string;
  readonly icon: string;
  readonly path: string;
  readonly permissionsAny?: readonly AppPermission[];
}

interface PolicyCommand {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly shortcut?: string;
  readonly permissionsAny?: readonly AppPermission[];
}

interface PolicyGroup {
  readonly id: string;
  readonly label: string;
  readonly commands: readonly PolicyCommand[];
}

interface PolicyTab {
  readonly id: string;
  readonly label: string;
  readonly groups: readonly PolicyGroup[];
}

export const CATALOG_ACCESS = [
  'PRODUCTS_MANAGE',
  'INVENTORY_VIEW',
  'SUPPLIERS_MANAGE',
  'SALES_MANAGE',
] as const satisfies readonly AppPermission[];
export const INVENTORY_ACCESS = [
  'INVENTORY_VIEW',
  'INVENTORY_ADJUST',
  'INVENTORY_TRANSFER',
  'INVENTORY_COUNT',
  'INVENTORY_APPROVE',
  'INVENTORY_VALUATION_MANAGE',
] as const satisfies readonly AppPermission[];
export const PURCHASES_ACCESS = [
  'SUPPLIERS_MANAGE',
  'PURCHASE_ORDERS_MANAGE',
  'PURCHASE_ORDERS_APPROVE',
] as const satisfies readonly AppPermission[];
export const SALES_ACCESS = [
  'SALES_MANAGE',
  'SALES_VOID',
  'SALES_RETURN',
  'SALE_REPRINT',
  'CASH_REGISTER_OPEN',
  'CASH_REGISTER_CLOSE',
] as const satisfies readonly AppPermission[];
export const REPORTS_ACCESS = [
  'SALES_MANAGE',
  'INVENTORY_VIEW',
  'AUDIT_VIEW',
  'AUDIT_EXPORT',
] as const satisfies readonly AppPermission[];
export const ADMINISTRATION_ACCESS = [
  'TENANT_MANAGE',
  'ACCESS_MANAGE',
  'PRIVACY_MANAGE',
  'NOTIFICATIONS_MANAGE',
] as const satisfies readonly AppPermission[];

export const WORKSPACE_NAVIGATION: readonly WorkspaceNavigationItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'pi pi-home', path: '/dashboard' },
  {
    id: 'catalogo',
    label: 'Catálogo',
    icon: 'pi pi-box',
    path: '/catalogo',
    permissionsAny: CATALOG_ACCESS,
  },
  {
    id: 'inventario',
    label: 'Inventario',
    icon: 'pi pi-warehouse',
    path: '/inventario',
    permissionsAny: INVENTORY_ACCESS,
  },
  {
    id: 'compras',
    label: 'Compras',
    icon: 'pi pi-truck',
    path: '/compras',
    permissionsAny: PURCHASES_ACCESS,
  },
  {
    id: 'ventas',
    label: 'Ventas',
    icon: 'pi pi-shopping-cart',
    path: '/ventas',
    permissionsAny: SALES_ACCESS,
  },
  {
    id: 'reportes',
    label: 'Reportes',
    icon: 'pi pi-chart-bar',
    path: '/reportes',
    permissionsAny: REPORTS_ACCESS,
  },
  {
    id: 'administracion',
    label: 'Administración',
    icon: 'pi pi-cog',
    path: '/administracion',
    permissionsAny: ADMINISTRATION_ACCESS,
  },
];

const COMMANDS: Record<WorkspaceId, readonly PolicyGroup[]> = {
  dashboard: [
    {
      id: 'overview',
      label: 'Resumen',
      commands: [
        { id: 'refresh-dashboard', label: 'Actualizar', icon: 'pi pi-refresh', shortcut: 'F5' },
      ],
    },
  ],
  catalogo: [
    {
      id: 'products',
      label: 'Productos',
      commands: [
        {
          id: 'new-product',
          label: 'Nuevo',
          icon: 'pi pi-plus',
          shortcut: 'Ctrl+N',
          permissionsAny: ['PRODUCTS_MANAGE'],
        },
        { id: 'search-product', label: 'Buscar', icon: 'pi pi-search', shortcut: '/' },
        {
          id: 'import-products',
          label: 'Importar',
          icon: 'pi pi-upload',
          permissionsAny: ['PRODUCTS_MANAGE'],
        },
        {
          id: 'pricing-rules',
          label: 'Reglas comerciales',
          icon: 'pi pi-tags',
          permissionsAny: ['PRODUCTS_MANAGE'],
        },
      ],
    },
  ],
  inventario: [
    {
      id: 'stock',
      label: 'Existencias',
      commands: [
        {
          id: 'stock-entry',
          label: 'Entrada',
          icon: 'pi pi-arrow-down-left',
          permissionsAny: ['INVENTORY_ADJUST'],
        },
        {
          id: 'stock-adjustment',
          label: 'Ajuste',
          icon: 'pi pi-sliders-h',
          permissionsAny: ['INVENTORY_ADJUST'],
        },
        {
          id: 'stock-count',
          label: 'Conteo',
          icon: 'pi pi-list-check',
          permissionsAny: ['INVENTORY_COUNT', 'INVENTORY_APPROVE', 'INVENTORY_VIEW'],
        },
        {
          id: 'inventory-import',
          label: 'Importar',
          icon: 'pi pi-upload',
          permissionsAny: ['INVENTORY_ADJUST'],
        },
        {
          id: 'inventory-transfers',
          label: 'Transferencias',
          icon: 'pi pi-truck',
          permissionsAny: ['INVENTORY_VIEW'],
        },
        {
          id: 'inventory-traceability',
          label: 'Trazabilidad',
          icon: 'pi pi-qrcode',
          permissionsAny: ['INVENTORY_VIEW'],
        },
      ],
    },
    {
      id: 'control',
      label: 'Control',
      commands: [
        {
          id: 'inventory-valuation',
          label: 'Valorización',
          icon: 'pi pi-chart-line',
          permissionsAny: ['INVENTORY_VIEW'],
        },
        {
          id: 'inventory-reconciliation',
          label: 'Conciliación',
          icon: 'pi pi-verified',
          permissionsAny: ['INVENTORY_VIEW'],
        },
        {
          id: 'inventory-alerts',
          label: 'Alertas',
          icon: 'pi pi-bell',
          permissionsAny: ['INVENTORY_VIEW'],
        },
      ],
    },
  ],
  compras: [
    {
      id: 'suppliers',
      label: 'Proveedores',
      commands: [
        {
          id: 'manage-suppliers',
          label: 'Proveedores',
          icon: 'pi pi-building',
          permissionsAny: ['SUPPLIERS_MANAGE'],
        },
      ],
    },
    {
      id: 'orders',
      label: 'Órdenes',
      commands: [
        {
          id: 'new-purchase',
          label: 'Nueva orden',
          icon: 'pi pi-plus',
          permissionsAny: ['PURCHASE_ORDERS_MANAGE'],
        },
        {
          id: 'receive-purchase',
          label: 'Recibir',
          icon: 'pi pi-inbox',
          permissionsAny: ['PURCHASE_ORDERS_MANAGE'],
        },
      ],
    },
  ],
  ventas: [
    {
      id: 'checkout',
      label: 'Punto de venta',
      commands: [
        {
          id: 'new-sale',
          label: 'Nueva venta',
          icon: 'pi pi-shopping-cart',
          shortcut: 'F2',
          permissionsAny: ['SALES_MANAGE'],
        },
        {
          id: 'sales-history',
          label: 'Historial',
          icon: 'pi pi-history',
          permissionsAny: SALES_ACCESS,
        },
      ],
    },
    {
      id: 'assisted-sales',
      label: 'Venta asistida',
      commands: [
        {
          id: 'sales-quotations',
          label: 'Cotizaciones',
          icon: 'pi pi-file-edit',
          permissionsAny: ['SALES_MANAGE'],
        },
        {
          id: 'customer-orders',
          label: 'Pedidos',
          icon: 'pi pi-box',
          permissionsAny: ['SALES_MANAGE'],
        },
        {
          id: 'product-reservations',
          label: 'Reservas',
          icon: 'pi pi-bookmark',
          permissionsAny: ['SALES_MANAGE'],
        },
      ],
    },
  ],
  reportes: [
    {
      id: 'analysis',
      label: 'Análisis',
      commands: [
        { id: 'run-report', label: 'Ejecutar', icon: 'pi pi-play', permissionsAny: REPORTS_ACCESS },
        {
          id: 'export-report',
          label: 'Exportar',
          icon: 'pi pi-download',
          permissionsAny: ['AUDIT_EXPORT', 'INVENTORY_VALUATION_MANAGE'],
        },
      ],
    },
  ],
  administracion: [
    {
      id: 'settings',
      label: 'Configuración',
      commands: [
        {
          id: 'company-settings',
          label: 'Empresa',
          icon: 'pi pi-building',
          permissionsAny: ['TENANT_MANAGE'],
        },
        {
          id: 'manage-users',
          label: 'Usuarios',
          icon: 'pi pi-users',
          permissionsAny: ['ACCESS_MANAGE'],
        },
        {
          id: 'manage-integrations',
          label: 'Integraciones',
          icon: 'pi pi-cloud',
          permissionsAny: ['TENANT_MANAGE'],
        },
        {
          id: 'manage-commerce',
          label: 'Comercio',
          icon: 'pi pi-shop',
          permissionsAny: ['TENANT_MANAGE'],
        },
      ],
    },
  ],
};

export function workspaceFromUrl(url: string): WorkspaceNavigationItem {
  const segment = url.split(/[?#]/)[0].split('/').filter(Boolean)[0] ?? 'dashboard';
  return (
    WORKSPACE_NAVIGATION.find((workspace) => workspace.id === segment) ?? WORKSPACE_NAVIGATION[0]
  );
}

export function workspaceAllowed(
  workspace: WorkspaceNavigationItem,
  permissions: ReadonlySet<AppPermission>,
): boolean {
  return (
    !workspace.permissionsAny?.length ||
    workspace.permissionsAny.some((permission) => permissions.has(permission))
  );
}

export function ribbonForWorkspace(
  workspace: WorkspaceNavigationItem,
  permissions: ReadonlySet<AppPermission> = new Set<AppPermission>(),
): readonly RibbonTab[] {
  const tabs: readonly PolicyTab[] = [
    { id: workspace.id, label: workspace.label, groups: COMMANDS[workspace.id] },
    {
      id: 'view',
      label: 'Vista',
      groups: [
        {
          id: 'display',
          label: 'Visualización',
          commands: [
            { id: 'toggle-density', label: 'Densidad', icon: 'pi pi-list' },
            { id: 'open-help', label: 'Ayuda', icon: 'pi pi-question-circle' },
          ],
        },
      ],
    },
  ];
  return tabs.map((tab) => ({
    ...tab,
    groups: tab.groups.map((group) => ({
      ...group,
      commands: group.commands.map(({ permissionsAny, ...command }) => ({
        ...command,
        disabled:
          Boolean(permissionsAny?.length) &&
          !permissionsAny?.some((permission) => permissions.has(permission)),
      })),
    })),
  }));
}
