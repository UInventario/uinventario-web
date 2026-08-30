import { TestBed } from '@angular/core/testing';
import { RibbonTab } from './ribbon.models';
import { Ribbon } from './ribbon';

const TABS: readonly RibbonTab[] = [
  {
    id: 'catalog',
    label: 'Catálogo',
    groups: [
      {
        id: 'products',
        label: 'Productos',
        commands: [{ id: 'new-product', label: 'Nuevo', icon: 'pi pi-plus' }],
      },
    ],
  },
  { id: 'stock', label: 'Stock', groups: [] },
];

describe('Ribbon', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Ribbon] }).compileComponents();
  });

  it('shows commands only for the active context', () => {
    const fixture = TestBed.createComponent(Ribbon);
    fixture.componentRef.setInput('tabs', TABS);
    fixture.componentRef.setInput('activeTabId', 'catalog');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[role="tabpanel"]')?.textContent).toContain('Nuevo');
    expect(element.querySelector('[aria-selected="true"]')?.textContent).toContain('Catálogo');
  });

  it('emits tab and command intentions', () => {
    const fixture = TestBed.createComponent(Ribbon);
    fixture.componentRef.setInput('tabs', TABS);
    fixture.componentRef.setInput('activeTabId', 'catalog');
    const selectedTabs: string[] = [];
    const commands: string[] = [];
    fixture.componentInstance.tabSelected.subscribe((id) => selectedTabs.push(id));
    fixture.componentInstance.commandInvoked.subscribe((id) => commands.push(id));
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    element.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1].click();
    element.querySelector<HTMLButtonElement>('.ribbon-command')?.click();

    expect(selectedTabs).toEqual(['stock']);
    expect(commands).toEqual(['new-product']);
  });
});
