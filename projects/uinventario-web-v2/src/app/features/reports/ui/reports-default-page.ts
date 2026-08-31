import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthorizationService } from '../../../core/authorization/authorization.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'ui-reports-default-page',
  template: '',
})
export class ReportsDefaultPage implements OnInit {
  private readonly authorization = inject(AuthorizationService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const destination = this.authorization.has('SALES_MANAGE')
      ? 'ventas'
      : this.authorization.has('INVENTORY_VIEW')
        ? 'inventario'
        : this.authorization.has('AUDIT_VIEW')
          ? 'auditoria'
          : 'exportaciones';
    void this.router.navigate(['/reportes', destination], { replaceUrl: true });
  }
}
