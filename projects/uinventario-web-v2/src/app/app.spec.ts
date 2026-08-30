import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideNoopAnimations()],
    }).compileComponents();
  });

  it('creates the greenfield application', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('identifies V2 and keeps a route to the stable frontend', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('h1')?.textContent).toContain('Una nueva interfaz');
    expect(element.querySelector<HTMLAnchorElement>('.stable-link')?.getAttribute('href')).toBe(
      '/',
    );
  });
});
