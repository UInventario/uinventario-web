import { Provider } from '@angular/core';
import { Routes } from '@angular/router';
import { CatalogFacade } from './application/catalog.facade';
import { CatalogApi } from './data/catalog-api.service';
import { CatalogGateway } from './domain/catalog.gateway';

const CATALOG_PROVIDERS: Provider[] = [
  CatalogApi,
  CatalogFacade,
  { provide: CatalogGateway, useExisting: CatalogApi },
];

export const CATALOG_ROUTES: Routes = [
  {
    path: '',
    providers: CATALOG_PROVIDERS,
    loadComponent: () =>
      import('./ui/catalog-page/catalog-page').then((module) => module.CatalogPage),
  },
];
