import { Routes } from '@angular/router';
import {
  requireAllPermissions,
  requireAnyPermission,
} from '../../core/authorization/permission.guard';
import { ReportFacade } from './application/report.facade';
import { ReportApi } from './data/report-api.service';
import { ReportGateway } from './domain/report.gateway';
import { ControlFacade } from './control/application/control.facade';
import { ControlApi } from './control/data/control-api.service';
import { ExportJobRegistry } from './control/data/export-job-registry';
import { ControlGateway } from './control/domain/control.gateway';

export const REPORTS_ROUTES: Routes = [
  {
    path: '',
    providers: [
      ReportFacade,
      ReportApi,
      { provide: ReportGateway, useExisting: ReportApi },
      ControlFacade,
      ControlApi,
      ExportJobRegistry,
      { provide: ControlGateway, useExisting: ControlApi },
    ],
    loadComponent: () => import('./ui/reports-page').then((module) => module.ReportsPage),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./ui/reports-default-page').then((m) => m.ReportsDefaultPage),
      },
      {
        path: 'ventas',
        canActivate: [requireAnyPermission('SALES_MANAGE')],
        loadComponent: () =>
          import('./ui/sales-report-page/sales-report-page').then((m) => m.SalesReportPage),
      },
      {
        path: 'caja',
        canActivate: [requireAnyPermission('SALES_MANAGE')],
        loadComponent: () =>
          import('./ui/cash-report-page/cash-report-page').then((m) => m.CashReportPage),
      },
      {
        path: 'margenes',
        canActivate: [requireAllPermissions('SALES_MANAGE', 'INVENTORY_VALUATION_MANAGE')],
        loadComponent: () =>
          import('./ui/profitability-report-page/profitability-report-page').then(
            (m) => m.ProfitabilityReportPage,
          ),
      },
      {
        path: 'inventario',
        canActivate: [requireAnyPermission('INVENTORY_VIEW')],
        loadComponent: () =>
          import('./ui/inventory-report-page/inventory-report-page').then(
            (m) => m.InventoryReportPage,
          ),
      },
      {
        path: 'actividad',
        canActivate: [requireAllPermissions('SALES_MANAGE', 'INVENTORY_VALUATION_MANAGE')],
        loadComponent: () =>
          import('./ui/activity-report-page/activity-report-page').then(
            (m) => m.ActivityReportPage,
          ),
      },
      {
        path: 'auditoria',
        canActivate: [requireAnyPermission('AUDIT_VIEW')],
        loadComponent: () =>
          import('./control/ui/audit-page/audit-page').then((m) => m.AuditPageComponent),
      },
      {
        path: 'exportaciones',
        canActivate: [requireAnyPermission('AUDIT_EXPORT')],
        loadComponent: () =>
          import('./control/ui/data-exports-page/data-exports-page').then((m) => m.DataExportsPage),
      },
    ],
  },
];
