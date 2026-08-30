import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PERMISSION_GROUPS, PermissionRisk } from '../../application/permission-catalog';
import { AccessRole, OperationalPermission } from '../../domain/access.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'ui-access-matrix',
  styleUrl: './access-matrix.scss',
  templateUrl: './access-matrix.html',
})
export class AccessMatrix {
  readonly roles = input.required<readonly AccessRole[]>();
  protected readonly permissionGroups = PERMISSION_GROUPS;

  protected roleHas(role: AccessRole, permission: OperationalPermission): boolean {
    return role.permissions.includes(permission);
  }

  protected riskLabel(risk: PermissionRisk): string {
    return { STANDARD: 'Estándar', ELEVATED: 'Elevado', CRITICAL: 'Crítico' }[risk];
  }
}
