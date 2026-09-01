import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  selector: 'ui-sales-operations-shell',
  styleUrl: './operations-shell.scss',
  templateUrl: './operations-shell.html',
})
export class SalesOperationsShell {}
