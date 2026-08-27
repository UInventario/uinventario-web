import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LoginPage } from './login.page';
import { SessionApiService, SessionResponse } from './session-api.service';

@Component({ template: '' })
class DestinationStub {}

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let sessions: { login: ReturnType<typeof vi.fn> };
  let router: Router;

  const response: SessionResponse = {
    data: {
      user: { id: 'user-id', email: 'admin@example.com', roles: ['ADMIN'] },
      tenant: { id: 'tenant-id', name: 'Tienda Central' },
      nextStep: 'ONBOARDING',
    },
    meta: {
      apiVersion: '1',
      sessionExpiresAt: '2026-08-27T15:00:00.000Z',
    },
  };

  beforeEach(async () => {
    sessions = { login: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        { provide: SessionApiService, useValue: sessions },
        provideRouter([
          { path: 'onboarding', component: DestinationStub },
          { path: 'app', component: DestinationStub },
        ]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPage);
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  function fill(id: string, value: string): void {
    const input = fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function submit(): void {
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  it('logs in and routes an unconfigured tenant to onboarding', async () => {
    sessions.login.mockReturnValue(of(response));
    fill('email', 'admin@example.com');
    fill('password', 'Correcta-2026!');

    submit();
    await fixture.whenStable();

    expect(sessions.login).toHaveBeenCalledWith('admin@example.com', 'Correcta-2026!');
    expect(router.url).toBe('/onboarding');
  });

  it('shows a generic error without revealing which credential failed', () => {
    sessions.login.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    fill('email', 'admin@example.com');
    fill('password', 'Incorrecta!');

    submit();

    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain('El correo o la contraseña no son válidos.');
  });
});
