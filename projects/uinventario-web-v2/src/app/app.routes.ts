import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./shell/app-shell/app-shell').then((module) => module.AppShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes').then((module) => module.DASHBOARD_ROUTES),
      },
      {
        path: 'catalogo',
        loadChildren: () =>
          import('./features/catalog/catalog.routes').then((module) => module.CATALOG_ROUTES),
      },
      {
        path: 'inventario',
        loadChildren: () =>
          import('./features/inventory/inventory.routes').then((module) => module.INVENTORY_ROUTES),
      },
      {
        path: 'compras',
        loadChildren: () =>
          import('./features/purchases/purchases.routes').then((module) => module.PURCHASES_ROUTES),
      },
      {
        path: 'ventas',
        loadChildren: () =>
          import('./features/sales/sales.routes').then((module) => module.SALES_ROUTES),
      },
      {
        path: 'reportes',
        loadChildren: () =>
          import('./features/reports/reports.routes').then((module) => module.REPORTS_ROUTES),
      },
      {
        path: 'administracion',
        loadChildren: () =>
          import('./features/administration/administration.routes').then(
            (module) => module.ADMINISTRATION_ROUTES,
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
