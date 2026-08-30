import { ChangeDetectionStrategy, Component } from '@angular/core';
import { WorkspaceLanding } from '../../../shared/ui/workspace-landing/workspace-landing';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WorkspaceLanding],
  selector: 'ui-catalog-page',
  template: `<ui-workspace-landing
    title="Catálogo"
    icon="pi pi-box"
    description="Productos, categorías, marcas, precios y códigos en un espacio dedicado."
  />`,
})
export class CatalogPage {}
