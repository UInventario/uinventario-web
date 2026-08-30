import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { TagModule } from 'primeng/tag';
import { Ribbon } from '../../shared/ui/ribbon/ribbon';
import {
  ribbonForWorkspace,
  WORKSPACE_NAVIGATION,
  workspaceFromUrl,
} from '../workspace-navigation';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Ribbon, RouterLink, RouterLinkActive, RouterOutlet, TagModule],
  selector: 'ui-app-shell',
  styleUrl: './app-shell.scss',
  templateUrl: './app-shell.html',
})
export class AppShell {
  private readonly router = inject(Router);

  protected readonly navigation = WORKSPACE_NAVIGATION;
  protected readonly navigationOpen = signal(false);
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
  protected readonly ribbonTabs = computed(() => ribbonForWorkspace(this.activeWorkspace()));
  protected readonly selectedRibbonTab = computed(() => {
    const selected = this.activeRibbonTab();
    return this.ribbonTabs().some((tab) => tab.id === selected)
      ? selected
      : this.activeWorkspace().id;
  });

  protected invokeCommand(commandId: string): void {
    this.commandStatus.set(`Comando disponible para ${this.activeWorkspace().label}: ${commandId}`);
  }

  protected closeNavigation(): void {
    this.navigationOpen.set(false);
  }
}
