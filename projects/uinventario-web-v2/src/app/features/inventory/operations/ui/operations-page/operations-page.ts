import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertPanel } from '../alert-panel/alert-panel';
import { CountWorkspace } from '../count-workspace/count-workspace';
import { ImportPanel } from '../import-panel/import-panel';

type OperationsView = 'COUNTS' | 'IMPORT' | 'ALERTS';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertPanel, CountWorkspace, ImportPanel],
  selector: 'ui-inventory-operations-page',
  styleUrls: ['./operations-page.scss', './operations-responsive.scss'],
  templateUrl: './operations-page.html',
})
export class OperationsPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly view = signal<OperationsView>('COUNTS');

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const value = params.get('view');
      this.view.set(value === 'import' ? 'IMPORT' : value === 'alerts' ? 'ALERTS' : 'COUNTS');
    });
  }

  protected selectView(view: OperationsView): void {
    const value = { COUNTS: 'counts', IMPORT: 'import', ALERTS: 'alerts' }[view];
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: value, session: null },
      queryParamsHandling: 'merge',
    });
  }
}
