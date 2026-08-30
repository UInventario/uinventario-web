import { Routes } from '@angular/router';

export const SALES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./ui/sales-page').then((module) => module.SalesPage),
  },
];
