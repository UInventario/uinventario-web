import { Routes } from '@angular/router';
import { InventoryFacade } from './application/inventory.facade';
import { InventoryApi } from './data/inventory-api.service';
import { InventoryGateway } from './domain/inventory.gateway';

export const INVENTORY_ROUTES: Routes = [
  {
    path: '',
    providers: [
      InventoryFacade,
      InventoryApi,
      { provide: InventoryGateway, useExisting: InventoryApi },
    ],
    loadComponent: () =>
      import('./ui/inventory-page/inventory-page').then((module) => module.InventoryPage),
  },
];
