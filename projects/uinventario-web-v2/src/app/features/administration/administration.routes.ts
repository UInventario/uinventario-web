import { Provider } from '@angular/core';
import { Routes } from '@angular/router';
import { AccessFacade } from './application/access.facade';
import { AccessApi } from './data/access-api.service';
import { AccessGateway } from './domain/access.gateway';

const ADMINISTRATION_PROVIDERS: Provider[] = [
  AccessApi,
  AccessFacade,
  { provide: AccessGateway, useExisting: AccessApi },
];

export const ADMINISTRATION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./ui/administration-default-page').then((module) => module.AdministrationDefaultPage),
  },
];

export const ACCESS_ADMIN_ROUTES: Routes = [
  {
    path: '',
    providers: ADMINISTRATION_PROVIDERS,
    loadComponent: () => import('./ui/access-page/access-page').then((module) => module.AccessPage),
  },
];
