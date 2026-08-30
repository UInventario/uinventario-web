import { ChangeDetectionStrategy, Component } from '@angular/core';
import { WorkspaceLanding } from '../../../shared/ui/workspace-landing/workspace-landing';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WorkspaceLanding],
  selector: 'ui-reports-page',
  template: `<ui-workspace-landing
    title="Reportes"
    icon="pi pi-chart-bar"
    description="Análisis y exportaciones bajo demanda en una ruta independiente."
  />`,
})
export class ReportsPage {}
