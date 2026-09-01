import { ChangeDetectionStrategy, Component } from '@angular/core';
import { WorkspaceLanding } from '../../../shared/ui/workspace-landing/workspace-landing';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WorkspaceLanding],
  selector: 'ui-purchases-page',
  template: `<ui-workspace-landing
    title="Compras"
    icon="pi pi-truck"
    description="Órdenes, proveedores y recepciones con su propio contexto operativo."
  />`,
})
export class PurchasesPage {}
