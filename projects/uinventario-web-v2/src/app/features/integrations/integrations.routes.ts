import { Provider } from '@angular/core';
import { Routes } from '@angular/router';
import { IntegrationFacade } from './application/integration.facade';
import { IntegrationApi } from './data/integration-api.service';
import { IntegrationGateway } from './domain/integration.gateway';

const INTEGRATION_PROVIDERS: Provider[] = [
  IntegrationApi,
  IntegrationFacade,
  { provide: IntegrationGateway, useExisting: IntegrationApi },
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
