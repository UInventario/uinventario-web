import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TagModule } from 'primeng/tag';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TagModule],
  selector: 'ui-workspace-landing',
  styleUrl: './workspace-landing.scss',
  templateUrl: './workspace-landing.html',
})
export class WorkspaceLanding {
  readonly description = input.required<string>();
  readonly icon = input.required<string>();
  readonly title = input.required<string>();
}
