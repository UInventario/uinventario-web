import { ChangeDetectionStrategy, Component } from '@angular/core';
import { WorkspaceLanding } from '../../../shared/ui/workspace-landing/workspace-landing';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WorkspaceLanding],
  selector: 'ui-inventory-page',
  template: `<ui-workspace-landing
    title="Inventario"
    icon="pi pi-warehouse"
    description="Existencias, movimientos, ajustes y conteos separados del catálogo."
  />`,
})
export class InventoryPage {}
