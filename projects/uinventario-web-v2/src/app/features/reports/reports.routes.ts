import { Routes } from '@angular/router';

export const REPORTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./ui/reports-page').then((module) => module.ReportsPage),
  },
];
