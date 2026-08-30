import { Routes } from '@angular/router';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./ui/dashboard-page').then((module) => module.DashboardPage),
  },
];
