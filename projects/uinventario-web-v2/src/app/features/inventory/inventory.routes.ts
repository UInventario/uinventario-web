import { Routes } from '@angular/router';
import { requireAnyPermission } from '../../core/authorization/permission.guard';
import { InventoryFacade } from './application/inventory.facade';
import { InventoryApi } from './data/inventory-api.service';
import { InventoryGateway } from './domain/inventory.gateway';
import { InventoryOperationsFacade } from './operations/application/inventory-operations.facade';
import { InventoryOperationsApi } from './operations/data/inventory-operations-api.service';
import { InventoryOperationsGateway } from './operations/domain/inventory-operations.gateway';
import { ValuationFacade } from './valuation/application/valuation.facade';
import { ValuationApi } from './valuation/data/valuation-api.service';
import { ValuationGateway } from './valuation/domain/valuation.gateway';
import { InventoryTransferFacade } from './transfers/application/inventory-transfer.facade';
import { InventoryTransferApi } from './transfers/data/inventory-transfer-api.service';
import { InventoryTransferGateway } from './transfers/domain/inventory-transfer.gateway';
import { TraceabilityFacade } from './traceability/application/traceability.facade';
import { TraceabilityApi } from './traceability/data/traceability-api.service';
import { TraceabilityGateway } from './traceability/domain/traceability.gateway';

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
    path: 'transferencias',
    canActivate: [requireAnyPermission('INVENTORY_VIEW')],
    providers: [
      InventoryTransferFacade,
      InventoryTransferApi,
      { provide: InventoryTransferGateway, useExisting: InventoryTransferApi },
    ],
    loadComponent: () =>
      import('./transfers/ui/transfer-page/transfer-page').then((module) => module.TransferPage),
  },
  {
    path: 'trazabilidad',
    canActivate: [requireAnyPermission('INVENTORY_VIEW')],
    providers: [
      InventoryFacade,
      InventoryApi,
      { provide: InventoryGateway, useExisting: InventoryApi },
      TraceabilityFacade,
      TraceabilityApi,
      { provide: TraceabilityGateway, useExisting: TraceabilityApi },
    ],
    loadComponent: () =>
      import('./traceability/ui/traceability-page/traceability-page').then(
        (module) => module.TraceabilityPage,
      ),
  },
  {
    path: 'control',
    canActivate: [
      requireAnyPermission(
        'INVENTORY_VIEW',
        'INVENTORY_COUNT',
        'INVENTORY_APPROVE',
        'INVENTORY_ADJUST',
      ),
    ],
    providers: [
      InventoryOperationsFacade,
      InventoryOperationsApi,
      { provide: InventoryOperationsGateway, useExisting: InventoryOperationsApi },
    ],
    loadComponent: () =>
      import('./operations/ui/operations-page/operations-page').then(
        (module) => module.OperationsPage,
      ),
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
