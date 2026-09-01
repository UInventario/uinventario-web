import { Routes } from '@angular/router';
import { requireAnyPermission } from '../../core/authorization/permission.guard';
import { ProcurementFacade } from './procurement/application/procurement.facade';
import { ProcurementApi } from './procurement/data/procurement-api.service';
import { ProcurementGateway } from './procurement/domain/procurement.gateway';
import { SupplierFacade } from './suppliers/application/supplier.facade';
import { SupplierApi } from './suppliers/data/supplier-api.service';
import { SupplierGateway } from './suppliers/domain/supplier.gateway';

export const PURCHASES_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'proveedores' },
  {
    path: 'proveedores',
    canActivate: [requireAnyPermission('SUPPLIERS_MANAGE')],
    providers: [
      SupplierFacade,
      SupplierApi,
      { provide: SupplierGateway, useExisting: SupplierApi },
    ],
    loadComponent: () =>
      import('./suppliers/ui/supplier-page/supplier-page').then((module) => module.SupplierPage),
  },
  {
    path: 'ordenes',
    canActivate: [requireAnyPermission('PURCHASE_ORDERS_MANAGE', 'PURCHASE_ORDERS_APPROVE')],
    providers: [
      ProcurementFacade,
      ProcurementApi,
      { provide: ProcurementGateway, useExisting: ProcurementApi },
    ],
    loadComponent: () =>
      import('./procurement/ui/procurement-page/procurement-page').then(
        (module) => module.ProcurementPage,
      ),
  },
];
