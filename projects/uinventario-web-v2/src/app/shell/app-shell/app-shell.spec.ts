import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { OperationalContextStore } from '../../core/operational-context/operational-context.store';
import { OfflineSync } from '../../core/offline/offline-sync';
import { SessionManager } from '../../core/session/session-manager';
import { SessionState } from '../../core/session/session-state';
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
        {
          provide: SessionState,
          useValue: {
            session: () => ({
              tenant: { id: 'tenant-1', name: 'Tienda Central' },
              user: {
                permissions: [
                  'PRODUCTS_MANAGE',
                  'INVENTORY_VIEW',
                  'PURCHASE_ORDERS_MANAGE',
                  'SALES_MANAGE',
                  'AUDIT_VIEW',
                  'TENANT_MANAGE',
                ],
              },
              context: {
                branch: { id: 'branch-1', name: 'Principal' },
                warehouse: { id: 'warehouse-1', name: 'Bodega' },
                cashRegister: null,
              },
            }),
          },
        },
        {
          provide: OperationalContextStore,
          useValue: {
            branches: () => [],
            loading: () => false,
            switching: () => false,
            error: () => null,
            load: vi.fn(() => of([])),
            change: vi.fn(),
          },
        },
        { provide: SessionManager, useValue: { logout: vi.fn(() => of(undefined)) } },
        {
          provide: OfflineSync,
          useValue: {
            state: () => 'ONLINE',
            summary: () => ({
              prepared: true,
              entities: 0,
              pending: 0,
              conflicts: 0,
              generatedAt: null,
              catalogStale: false,
              permissionsStale: false,
              sessionExpired: false,
            }),
            commands: () => [],
            error: () => null,
            busy: () => false,
            online: () => true,
            restore: vi.fn(() => Promise.resolve()),
            prepare: vi.fn(() => Promise.resolve()),
            reconnect: vi.fn(() => Promise.resolve()),
            retry: vi.fn(() => Promise.resolve()),
            discard: vi.fn(() => Promise.resolve()),
          },
        },
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
    const skipLink = element.querySelector('.skip-link') as HTMLAnchorElement;
    expect(element.querySelectorAll('aside nav a').length).toBe(7);
    expect(skipLink.getAttribute('href')).toBe('#workspace-content');
    skipLink.click();
    expect(document.activeElement).toBe(element.querySelector('#workspace-content'));
  });

  it('moves focus to the workspace after an in-app navigation', async () => {
    await router.navigateByUrl('/dashboard');
    fixture.detectChanges();

    await router.navigateByUrl('/ventas');
    fixture.detectChanges();
    await Promise.resolve();

    expect(document.activeElement).toBe(
      (fixture.nativeElement as HTMLElement).querySelector('#workspace-content'),
    );
  });

  it('preserves focus when only route filters change', async () => {
    await router.navigateByUrl('/dashboard');
    fixture.detectChanges();
    const skipLink = (fixture.nativeElement as HTMLElement).querySelector(
      '.skip-link',
    ) as HTMLAnchorElement;
    skipLink.focus();

    await router.navigateByUrl('/dashboard?period=today');
    fixture.detectChanges();
    await Promise.resolve();

    expect(document.activeElement).toBe(skipLink);
  });
});
