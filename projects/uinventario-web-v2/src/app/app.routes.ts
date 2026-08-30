import { Routes } from '@angular/router';
import { sessionGuard } from './core/session/session.guard';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Iniciar sesión | UInventario',
    loadChildren: () =>
      import('./features/identity/identity.routes').then((module) => module.LOGIN_ROUTES),
  },
  {
    path: 'registro',
    title: 'Crear cuenta | UInventario',
    loadChildren: () =>
      import('./features/identity/identity.routes').then((module) => module.REGISTRATION_ROUTES),
  },
  {
    path: 'recuperar',
    title: 'Recuperar contraseña | UInventario',
    loadChildren: () =>
      import('./features/identity/identity.routes').then(
        (module) => module.PASSWORD_RESET_REQUEST_ROUTES,
      ),
  },
  {
    path: 'restablecer',
    title: 'Restablecer contraseña | UInventario',
    loadChildren: () =>
      import('./features/identity/identity.routes').then(
        (module) => module.PASSWORD_RESET_COMPLETE_ROUTES,
      ),
  },
  {
    path: '',
    canActivate: [sessionGuard],
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
