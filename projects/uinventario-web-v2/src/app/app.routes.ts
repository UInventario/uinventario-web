import { Routes } from '@angular/router';
import { requireAnyPermission } from './core/authorization/permission.guard';
import { sessionGuard } from './core/session/session.guard';
import {
  ADMINISTRATION_ACCESS,
  CATALOG_ACCESS,
  INVENTORY_ACCESS,
  PURCHASES_ACCESS,
  REPORTS_ACCESS,
  SALES_ACCESS,
} from './shell/workspace-navigation';

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
    path: 'onboarding',
    title: 'Configuración inicial | UInventario',
    canActivate: [sessionGuard],
    loadChildren: () =>
      import('./features/organization/organization.routes').then(
        (module) => module.ONBOARDING_ROUTES,
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
        canActivate: [requireAnyPermission(...CATALOG_ACCESS)],
        loadChildren: () =>
          import('./features/catalog/catalog.routes').then((module) => module.CATALOG_ROUTES),
      },
      {
        path: 'inventario',
        canActivate: [requireAnyPermission(...INVENTORY_ACCESS)],
        loadChildren: () =>
          import('./features/inventory/inventory.routes').then((module) => module.INVENTORY_ROUTES),
      },
      {
        path: 'compras',
        canActivate: [requireAnyPermission(...PURCHASES_ACCESS)],
        loadChildren: () =>
          import('./features/purchases/purchases.routes').then((module) => module.PURCHASES_ROUTES),
      },
      {
        path: 'ventas',
        canActivate: [requireAnyPermission(...SALES_ACCESS)],
        loadChildren: () =>
          import('./features/sales/sales.routes').then((module) => module.SALES_ROUTES),
      },
      {
        path: 'reportes',
        canActivate: [requireAnyPermission(...REPORTS_ACCESS)],
        loadChildren: () =>
          import('./features/reports/reports.routes').then((module) => module.REPORTS_ROUTES),
      },
      {
        path: 'administracion/empresa',
        canActivate: [requireAnyPermission('TENANT_MANAGE')],
        loadChildren: () =>
          import('./features/organization/organization.routes').then(
            (module) => module.ORGANIZATION_ADMIN_ROUTES,
          ),
      },
      {
        path: 'administracion/accesos',
        canActivate: [requireAnyPermission('ACCESS_MANAGE')],
        loadChildren: () =>
          import('./features/administration/administration.routes').then(
            (module) => module.ACCESS_ADMIN_ROUTES,
          ),
      },
      {
        path: 'administracion',
        canActivate: [requireAnyPermission(...ADMINISTRATION_ACCESS)],
        loadChildren: () =>
          import('./features/administration/administration.routes').then(
            (module) => module.ADMINISTRATION_ROUTES,
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
