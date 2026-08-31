import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { AuthorizationService } from '../../core/authorization/authorization.service';
import { SessionManager } from '../../core/session/session-manager';
import { Ribbon } from '../../shared/ui/ribbon/ribbon';
import { OperationalContextPicker } from '../operational-context-picker/operational-context-picker';
import { OfflineCenter } from '../offline-center/offline-center';
import {
  ribbonForWorkspace,
  WORKSPACE_NAVIGATION,
  workspaceAllowed,
  workspaceFromUrl,
} from '../workspace-navigation';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonModule,
    OperationalContextPicker,
    OfflineCenter,
    Ribbon,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    TagModule,
  ],
  selector: 'ui-app-shell',
  styleUrl: './app-shell.scss',
  templateUrl: './app-shell.html',
})
export class AppShell {
  private readonly router = inject(Router);
  private readonly authorization = inject(AuthorizationService);
  private readonly sessionManager = inject(SessionManager);

  protected readonly navigation = computed(() =>
    WORKSPACE_NAVIGATION.filter((workspace) =>
      workspaceAllowed(workspace, this.authorization.permissions()),
    ),
  );
  protected readonly navigationOpen = signal(false);
  protected readonly loggingOut = signal(false);
  protected readonly activeRibbonTab = signal('');
  protected readonly commandStatus = signal('');
  protected readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { requireSync: true },
  );
  protected readonly activeWorkspace = computed(() => workspaceFromUrl(this.currentUrl()));
  protected readonly posMode = computed(() => /^\/ventas\/pos(?:[/?#]|$)/.test(this.currentUrl()));
  protected readonly accessDenied = computed(() => {
    const query = this.currentUrl().split('?')[1] ?? '';
    return new URLSearchParams(query).get('accessDenied') === 'true';
  });
  protected readonly ribbonTabs = computed(() =>
    ribbonForWorkspace(this.activeWorkspace(), this.authorization.permissions()),
  );
  protected readonly selectedRibbonTab = computed(() => {
    const selected = this.activeRibbonTab();
    return this.ribbonTabs().some((tab) => tab.id === selected)
      ? selected
      : this.activeWorkspace().id;
  });

  protected invokeCommand(commandId: string): void {
    const command = this.ribbonTabs()
      .flatMap((tab) => tab.groups)
      .flatMap((group) => group.commands)
      .find((candidate) => candidate.id === commandId);
    if (!command || command.disabled) {
      this.commandStatus.set('No tienes permiso para ejecutar este comando.');
      return;
    }
    if (commandId === 'refresh-dashboard') {
      globalThis.location.reload();
      return;
    }
    if (commandId === 'new-sale') {
      void this.router.navigate(['/ventas/pos']);
      return;
    }
    if (commandId === 'pricing-rules') {
      void this.router.navigate(['/catalogo/precios']);
      return;
    }
    if (commandId === 'sales-history') {
      void this.router.navigate(['/ventas/historial']);
      return;
    }
    if (commandId === 'sales-quotations') {
      void this.router.navigate(['/ventas/operaciones/cotizaciones']);
      return;
    }
    if (commandId === 'customer-orders') {
      void this.router.navigate(['/ventas/operaciones/pedidos']);
      return;
    }
    if (commandId === 'product-reservations') {
      void this.router.navigate(['/ventas/operaciones/reservas']);
      return;
    }
    if (commandId === 'company-settings') {
      void this.router.navigate(['/administracion/empresa']);
      return;
    }
    if (commandId === 'manage-users') {
      void this.router.navigate(['/administracion/accesos']);
      return;
    }
    if (commandId === 'manage-suppliers') {
      void this.router.navigate(['/compras/proveedores']);
      return;
    }
    if (commandId === 'new-purchase') {
      void this.router.navigate(['/compras/ordenes'], { queryParams: { action: 'nueva' } });
      return;
    }
    if (commandId === 'receive-purchase') {
      void this.router.navigate(['/compras/ordenes']);
      return;
    }
    if (commandId === 'inventory-valuation') {
      void this.router.navigate(['/inventario/valorizacion']);
      return;
    }
    if (commandId === 'inventory-reconciliation') {
      void this.router.navigate(['/inventario/valorizacion'], {
        queryParams: { view: 'reconciliation' },
      });
      return;
    }
    if (commandId === 'stock-count') {
      void this.router.navigate(['/inventario/control'], { queryParams: { view: 'counts' } });
      return;
    }
    if (commandId === 'inventory-import') {
      void this.router.navigate(['/inventario/control'], { queryParams: { view: 'import' } });
      return;
    }
    if (commandId === 'inventory-alerts') {
      void this.router.navigate(['/inventario/control'], { queryParams: { view: 'alerts' } });
      return;
    }
    if (commandId === 'inventory-transfers') {
      void this.router.navigate(['/inventario/transferencias']);
      return;
    }
    this.commandStatus.set(`Comando disponible para ${this.activeWorkspace().label}: ${commandId}`);
  }

  protected closeNavigation(): void {
    this.navigationOpen.set(false);
  }

  protected logout(): void {
    if (this.loggingOut()) return;
    this.loggingOut.set(true);
    this.sessionManager.logout().subscribe({
      error: () => this.loggingOut.set(false),
    });
  }
}
