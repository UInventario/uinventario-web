import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AccessUser } from '../../domain/access.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'ui-access-user-table',
  styleUrl: './access-user-table.scss',
  templateUrl: './access-user-table.html',
})
export class AccessUserTable {
  readonly users = input.required<readonly AccessUser[]>();
  readonly edit = output<AccessUser>();
  readonly retire = output<AccessUser>();
}
