import { RibbonTab } from '../shared/ui/ribbon/ribbon.models';

export type WorkspaceId =
  'dashboard' | 'catalogo' | 'inventario' | 'compras' | 'ventas' | 'reportes' | 'administracion';

export interface WorkspaceNavigationItem {
  readonly id: WorkspaceId;
  readonly label: string;
  readonly icon: string;
  readonly path: string;
}

export const WORKSPACE_NAVIGATION: readonly WorkspaceNavigationItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'pi pi-home', path: '/dashboard' },
  { id: 'catalogo', label: 'Catálogo', icon: 'pi pi-box', path: '/catalogo' },
  { id: 'inventario', label: 'Inventario', icon: 'pi pi-warehouse', path: '/inventario' },
  { id: 'compras', label: 'Compras', icon: 'pi pi-truck', path: '/compras' },
  { id: 'ventas', label: 'Ventas', icon: 'pi pi-shopping-cart', path: '/ventas' },
  { id: 'reportes', label: 'Reportes', icon: 'pi pi-chart-bar', path: '/reportes' },
  {
    id: 'administracion',
    label: 'Administración',
    icon: 'pi pi-cog',
    path: '/administracion',
  },
];

const COMMANDS: Record<WorkspaceId, RibbonTab['groups']> = {
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
        { id: 'new-product', label: 'Nuevo', icon: 'pi pi-plus', shortcut: 'Ctrl+N' },
        { id: 'search-product', label: 'Buscar', icon: 'pi pi-search', shortcut: '/' },
        { id: 'import-products', label: 'Importar', icon: 'pi pi-upload' },
      ],
    },
  ],
  inventario: [
    {
      id: 'stock',
      label: 'Existencias',
      commands: [
        { id: 'stock-entry', label: 'Entrada', icon: 'pi pi-arrow-down-left' },
        { id: 'stock-adjustment', label: 'Ajuste', icon: 'pi pi-sliders-h' },
        { id: 'stock-count', label: 'Conteo', icon: 'pi pi-list-check' },
      ],
    },
  ],
  compras: [
    {
      id: 'orders',
      label: 'Órdenes',
      commands: [
        { id: 'new-purchase', label: 'Nueva orden', icon: 'pi pi-plus' },
        { id: 'receive-purchase', label: 'Recibir', icon: 'pi pi-inbox' },
      ],
    },
  ],
  ventas: [
    {
      id: 'checkout',
      label: 'Punto de venta',
      commands: [
        { id: 'new-sale', label: 'Nueva venta', icon: 'pi pi-shopping-cart', shortcut: 'F2' },
        { id: 'sales-history', label: 'Historial', icon: 'pi pi-history' },
      ],
    },
  ],
  reportes: [
    {
      id: 'analysis',
      label: 'Análisis',
      commands: [
        { id: 'run-report', label: 'Ejecutar', icon: 'pi pi-play' },
        { id: 'export-report', label: 'Exportar', icon: 'pi pi-download' },
      ],
    },
  ],
  administracion: [
    {
      id: 'settings',
      label: 'Configuración',
      commands: [
        { id: 'company-settings', label: 'Empresa', icon: 'pi pi-building' },
        { id: 'manage-users', label: 'Usuarios', icon: 'pi pi-users' },
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

export function ribbonForWorkspace(workspace: WorkspaceNavigationItem): readonly RibbonTab[] {
  return [
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
}
