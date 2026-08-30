import { Routes } from '@angular/router';
import { requireAnyPermission } from '../../core/authorization/permission.guard';
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
];
