import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, RouterOutlet, TagModule],
  selector: 'ui-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {}
