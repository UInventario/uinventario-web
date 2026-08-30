import { Routes } from '@angular/router';
import { requireAnyPermission } from '../../core/authorization/permission.guard';
import { CustomerFacade } from './customers/application/customer.facade';
import { CustomerApi } from './customers/data/customer-api.service';
import { CustomerGateway } from './customers/domain/customer.gateway';

export const SALES_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'clientes' },
  {
    path: 'clientes',
    canActivate: [requireAnyPermission('SALES_MANAGE')],
    providers: [
      CustomerFacade,
      CustomerApi,
      { provide: CustomerGateway, useExisting: CustomerApi },
    ],
    loadComponent: () =>
      import('./customers/ui/customer-page/customer-page').then((module) => module.CustomerPage),
  },
];
