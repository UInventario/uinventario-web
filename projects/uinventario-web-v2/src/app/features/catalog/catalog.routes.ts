import { Routes } from '@angular/router';

export const CATALOG_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./ui/catalog-page').then((module) => module.CatalogPage),
  },
];
