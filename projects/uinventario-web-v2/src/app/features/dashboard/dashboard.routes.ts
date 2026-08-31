import { Routes } from '@angular/router';
import {
  requireAllPermissions,
  requireAnyPermission,
} from '../../core/authorization/permission.guard';
import { DashboardFacade } from './application/dashboard.facade';
import { DashboardApi } from './data/dashboard-api.service';
import { DashboardGateway } from './domain/dashboard.gateway';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    providers: [
      DashboardFacade,
      DashboardApi,
      { provide: DashboardGateway, useExisting: DashboardApi },
    ],
    loadComponent: () => import('./ui/dashboard-page').then((module) => module.DashboardPage),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'resumen' },
      {
        path: 'resumen',
        loadComponent: () =>
          import('./ui/dashboard-overview-page/dashboard-overview-page').then(
            (module) => module.DashboardOverviewPage,
          ),
      },
      {
        path: 'pronostico',
        canActivate: [requireAllPermissions('SALES_MANAGE', 'INVENTORY_VIEW')],
        loadComponent: () =>
          import('./ui/forecast-page/forecast-page').then((module) => module.ForecastPage),
      },
      {
        path: 'notificaciones',
        canActivate: [requireAnyPermission('NOTIFICATIONS_VIEW')],
        loadComponent: () =>
          import('./ui/notification-center-page/notification-center-page').then(
            (module) => module.NotificationCenterPage,
          ),
      },
    ],
  },
];
