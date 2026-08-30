import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, TagModule],
  selector: 'ui-bootstrap-page',
  styleUrl: './bootstrap-page.scss',
  templateUrl: './bootstrap-page.html',
})
export class BootstrapPage {}
