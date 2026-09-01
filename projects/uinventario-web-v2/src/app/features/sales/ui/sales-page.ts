import { ChangeDetectionStrategy, Component } from '@angular/core';
import { WorkspaceLanding } from '../../../shared/ui/workspace-landing/workspace-landing';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WorkspaceLanding],
  selector: 'ui-sales-page',
  template: `<ui-workspace-landing
    title="Ventas"
    icon="pi pi-shopping-cart"
    description="Punto de venta e historial sin mezclar el resto de la administración."
  />`,
})
export class SalesPage {}
