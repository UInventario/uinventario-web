import { Routes } from '@angular/router';
import { requireAnyPermission } from '../../core/authorization/permission.guard';
import { InventoryFacade } from './application/inventory.facade';
import { InventoryApi } from './data/inventory-api.service';
import { InventoryGateway } from './domain/inventory.gateway';
import { ValuationFacade } from './valuation/application/valuation.facade';
import { ValuationApi } from './valuation/data/valuation-api.service';
import { ValuationGateway } from './valuation/domain/valuation.gateway';

export const INVENTORY_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    providers: [
      InventoryFacade,
      InventoryApi,
      { provide: InventoryGateway, useExisting: InventoryApi },
    ],
    loadComponent: () =>
      import('./ui/inventory-page/inventory-page').then((module) => module.InventoryPage),
  },
  {
    path: 'valorizacion',
    canActivate: [requireAnyPermission('INVENTORY_VIEW')],
    providers: [
      ValuationFacade,
      ValuationApi,
      { provide: ValuationGateway, useExisting: ValuationApi },
    ],
    loadComponent: () =>
      import('./valuation/ui/valuation-page/valuation-page').then((module) => module.ValuationPage),
  },
];
