import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { RibbonTab } from './ribbon.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule],
  selector: 'ui-ribbon',
  styleUrl: './ribbon.scss',
  templateUrl: './ribbon.html',
})
export class Ribbon {
  readonly activeTabId = input('');
  readonly ariaLabel = input('Comandos de la página');
  readonly tabs = input<readonly RibbonTab[]>([]);
  readonly commandInvoked = output<string>();
  readonly tabSelected = output<string>();

  protected readonly activeTab = computed(() => {
    const tabs = this.tabs();
    return tabs.find((tab) => tab.id === this.activeTabId()) ?? tabs[0];
  });

  protected selectTab(tabId: string): void {
    if (tabId !== this.activeTab()?.id) this.tabSelected.emit(tabId);
  }

  protected handleTabKeydown(event: KeyboardEvent, currentIndex: number): void {
    const tabs = this.tabs();
    if (!tabs.length) return;

    let targetIndex: number | undefined;
    if (event.key === 'ArrowRight') targetIndex = (currentIndex + 1) % tabs.length;
    if (event.key === 'ArrowLeft') targetIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') targetIndex = 0;
    if (event.key === 'End') targetIndex = tabs.length - 1;
    if (targetIndex === undefined) return;

    event.preventDefault();
    this.tabSelected.emit(tabs[targetIndex].id);
    const buttons = (
      event.currentTarget as HTMLElement
    ).parentElement?.querySelectorAll<HTMLElement>('[role="tab"]');
    buttons?.item(targetIndex).focus();
  }
}
