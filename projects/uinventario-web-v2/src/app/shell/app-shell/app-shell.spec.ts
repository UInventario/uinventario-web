import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AppShell } from './app-shell';

@Component({ template: '<p>Contenido</p>' })
class StubWorkspace {}

describe('AppShell', () => {
  let fixture: ComponentFixture<AppShell>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppShell],
      providers: [
        provideRouter([
          { path: 'dashboard', component: StubWorkspace },
          { path: 'ventas', component: StubWorkspace },
        ]),
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(AppShell);
  });

  it('keeps the shell while navigation changes its context', async () => {
    await router.navigateByUrl('/ventas');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.brand')).not.toBeNull();
    expect(element.querySelector('[aria-current="page"]')?.textContent).toContain('Ventas');
    expect(element.querySelector('[role="tab"]')?.textContent).toContain('Ventas');
  });

  it('exposes navigation and a keyboard skip link', () => {
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('aside nav a').length).toBe(7);
    expect(element.querySelector('.skip-link')?.getAttribute('href')).toBe('#workspace-content');
  });
});
