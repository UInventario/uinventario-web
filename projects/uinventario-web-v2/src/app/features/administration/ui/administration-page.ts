import { ChangeDetectionStrategy, Component } from '@angular/core';
import { WorkspaceLanding } from '../../../shared/ui/workspace-landing/workspace-landing';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WorkspaceLanding],
  selector: 'ui-administration-page',
  template: `<ui-workspace-landing
    title="Administración"
    icon="pi pi-cog"
    description="Empresa, sucursales, usuarios y permisos en un contexto restringido."
  />`,
})
export class AdministrationPage {}
