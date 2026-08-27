import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { RegistrationApiService, RegistrationResponse } from './registration-api.service';
import { RegistrationPage } from './registration.page';

@Component({ template: '' })
class LoginStub {}

describe('RegistrationPage', () => {
  let fixture: ComponentFixture<RegistrationPage>;
  let api: { register: ReturnType<typeof vi.fn> };
  let router: Router;

  const response: RegistrationResponse = {
    data: {
      tenant: { id: 'tenant-id', name: 'Tienda Central' },
      user: { id: 'user-id', email: 'admin@example.com' },
      nextStep: 'LOGIN',
    },
    meta: { apiVersion: '1' },
  };

  beforeEach(async () => {
    api = { register: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [RegistrationPage],
      providers: [
        { provide: RegistrationApiService, useValue: api },
        provideRouter([{ path: 'login', component: LoginStub }]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegistrationPage);
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

  it('registers valid data and routes to login', async () => {
    api.register.mockReturnValue(of(response));
    fill('organizationName', 'Tienda Central');
    fill('email', 'admin@example.com');
    fill('password', 'Correcta-2026!');
    fill('passwordConfirmation', 'Correcta-2026!');

    submit();
    await fixture.whenStable();

    expect(api.register).toHaveBeenCalledWith(
      {
        organizationName: 'Tienda Central',
        email: 'admin@example.com',
        password: 'Correcta-2026!',
      },
      expect.any(String),
    );
    expect(router.url).toBe('/login');
  });

  it('shows a generic message when registration conflicts', () => {
    api.register.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    fill('organizationName', 'Tienda Central');
    fill('email', 'admin@example.com');
    fill('password', 'Correcta-2026!');
    fill('passwordConfirmation', 'Correcta-2026!');

    submit();

    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain('No fue posible crear la cuenta');
  });
});
