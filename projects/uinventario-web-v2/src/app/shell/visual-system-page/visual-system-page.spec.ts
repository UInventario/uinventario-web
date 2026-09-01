import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { VisualSystemPage } from './visual-system-page';

describe('VisualSystemPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VisualSystemPage],
      providers: [provideNoopAnimations()],
    }).compileComponents();
  });

  it('shows contextual commands and every required operational state', () => {
    const fixture = TestBed.createComponent(VisualSystemPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[role="tablist"]')).toBeTruthy();
    expect(element.querySelectorAll('.state-picker button')).toHaveLength(5);
    expect(element.textContent).toContain('Aún no hay información');
  });

  it('changes the operational state from the accessible selector', () => {
    const fixture = TestBed.createComponent(VisualSystemPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    Array.from(element.querySelectorAll<HTMLButtonElement>('.state-picker button'))
      .find((button) => button.textContent?.includes('Offline'))
      ?.click();
    fixture.detectChanges();

    expect(element.textContent).toContain('Sin conexión');
  });
});
