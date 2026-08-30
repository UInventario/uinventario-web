import { Routes } from '@angular/router';
import { requireAnyPermission } from '../../core/authorization/permission.guard';
import { CustomerFacade } from './customers/application/customer.facade';
import { CustomerApi } from './customers/data/customer-api.service';
import { CustomerGateway } from './customers/domain/customer.gateway';
import { CashFacade } from './cash/application/cash.facade';
import { CashApi } from './cash/data/cash-api.service';
import { CashGateway } from './cash/domain/cash.gateway';
import { PosCartStore } from './pos/application/pos-cart.store';
import { PosFacade } from './pos/application/pos.facade';
import { PosApi } from './pos/data/pos-api.service';
import { PosGateway } from './pos/domain/pos.gateway';
import { SalesLifecycleFacade } from './lifecycle/application/sales-lifecycle.facade';
import { SalesLifecycleApi } from './lifecycle/data/sales-lifecycle-api.service';
import { SalesLifecycleGateway } from './lifecycle/domain/sales-lifecycle.gateway';

export const SALES_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'pos' },
  {
    path: 'pos',
    canActivate: [requireAnyPermission('SALES_MANAGE')],
    providers: [PosCartStore, PosFacade, PosApi, { provide: PosGateway, useExisting: PosApi }],
    loadComponent: () => import('./pos/ui/pos-page/pos-page').then((module) => module.PosPage),
  },
  {
    path: 'caja',
    canActivate: [
      requireAnyPermission('CASH_REGISTER_OPEN', 'CASH_REGISTER_CLOSE', 'CASH_REGISTER_MOVE'),
    ],
    providers: [CashFacade, CashApi, { provide: CashGateway, useExisting: CashApi }],
    loadComponent: () => import('./cash/ui/cash-page/cash-page').then((module) => module.CashPage),
  },
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
  {
    path: 'historial',
    canActivate: [
      requireAnyPermission('SALES_MANAGE', 'SALE_REPRINT', 'SALES_VOID', 'SALES_RETURN'),
    ],
    providers: [
      SalesLifecycleFacade,
      SalesLifecycleApi,
      { provide: SalesLifecycleGateway, useExisting: SalesLifecycleApi },
    ],
    loadComponent: () =>
      import('./lifecycle/ui/sales-lifecycle-page/sales-lifecycle-page').then(
        (module) => module.SalesLifecyclePage,
      ),
  },
];
