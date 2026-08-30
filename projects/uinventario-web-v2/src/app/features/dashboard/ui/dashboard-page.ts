import { ChangeDetectionStrategy, Component } from '@angular/core';
import { WorkspaceLanding } from '../../../shared/ui/workspace-landing/workspace-landing';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WorkspaceLanding],
  selector: 'ui-dashboard-page',
  template: `<ui-workspace-landing
    title="Dashboard"
    icon="pi pi-home"
    description="Visión general de la operación y accesos prioritarios."
  />`,
})
export class DashboardPage {}
