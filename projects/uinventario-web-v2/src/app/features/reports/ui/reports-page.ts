import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthorizationService } from '../../../core/authorization/authorization.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  selector: 'ui-reports-page',
  styleUrl: './reports-page.scss',
  templateUrl: './reports-page.html',
})
export class ReportsPage {
  private readonly authorization = inject(AuthorizationService);

  protected readonly canSales = computed(() => this.authorization.has('SALES_MANAGE'));
  protected readonly canInventory = computed(() => this.authorization.has('INVENTORY_VIEW'));
  protected readonly canProfitability = computed(() =>
    this.authorization.hasAll(['SALES_MANAGE', 'INVENTORY_VALUATION_MANAGE']),
  );
}
