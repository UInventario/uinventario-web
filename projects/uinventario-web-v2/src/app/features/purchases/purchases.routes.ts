import { Routes } from '@angular/router';

export const PURCHASES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./ui/purchases-page').then((module) => module.PurchasesPage),
  },
];
