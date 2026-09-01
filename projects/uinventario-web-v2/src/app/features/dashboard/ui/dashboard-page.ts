import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthorizationService } from '../../../core/authorization/authorization.service';
import { SessionState } from '../../../core/session/session-state';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  selector: 'ui-dashboard-page',
  styleUrl: './dashboard-page.scss',
  templateUrl: './dashboard-page.html',
})
export class DashboardPage {
  private readonly authorization = inject(AuthorizationService);
  private readonly sessions = inject(SessionState);

  protected readonly context = computed(() => this.sessions.session()?.context);
  protected readonly canForecast = computed(() =>
    this.authorization.hasAll(['SALES_MANAGE', 'INVENTORY_VIEW']),
  );
  protected readonly canNotifications = computed(() =>
    this.authorization.has('NOTIFICATIONS_VIEW'),
  );
}
