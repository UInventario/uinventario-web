import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { BootstrapPage } from './bootstrap-page';

describe('BootstrapPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BootstrapPage],
      providers: [provideNoopAnimations()],
    }).compileComponents();
  });

  it('identifies V2 and keeps a route to the stable frontend', () => {
    const fixture = TestBed.createComponent(BootstrapPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('h1')?.textContent).toContain('Una nueva interfaz');
    expect(element.querySelector<HTMLAnchorElement>('.stable-link')?.getAttribute('href')).toBe(
      '/',
    );
  });
});
