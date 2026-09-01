import { Provider } from '@angular/core';
import { Routes } from '@angular/router';
import { IntegrationFacade } from './application/integration.facade';
import { CommerceFacade } from './application/commerce.facade';
import { CommerceApi } from './data/commerce-api.service';
import { IntegrationApi } from './data/integration-api.service';
import { CommerceGateway } from './domain/commerce.gateway';
import { IntegrationGateway } from './domain/integration.gateway';

const INTEGRATION_PROVIDERS: Provider[] = [
  IntegrationApi,
  IntegrationFacade,
  { provide: IntegrationGateway, useExisting: IntegrationApi },
];

const COMMERCE_PROVIDERS: Provider[] = [
  CommerceApi,
  CommerceFacade,
  { provide: CommerceGateway, useExisting: CommerceApi },
];

export const INTEGRATION_ROUTES: Routes = [
  {
    path: '',
    providers: INTEGRATION_PROVIDERS,
    loadComponent: () =>
      import('./ui/integration-console-page/integration-console-page').then(
        (module) => module.IntegrationConsolePage,
      ),
  },
];

export const COMMERCE_INTEGRATION_ROUTES: Routes = [
  {
    path: '',
    providers: COMMERCE_PROVIDERS,
    loadComponent: () =>
      import('./ui/commerce-console-page/commerce-console-page').then(
        (module) => module.CommerceConsolePage,
      ),
  },
];
