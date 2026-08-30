import { Routes } from '@angular/router';

export const INVENTORY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./ui/inventory-page').then((module) => module.InventoryPage),
  },
];
