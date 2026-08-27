import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { PasswordResetApiService } from './password-reset-api.service';
import { PasswordResetPage } from './password-reset.page';

describe('PasswordResetPage', () => {
  async function createPage(mode: 'request' | 'complete', token: string | null = null) {
    const api = { request: vi.fn(), complete: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [PasswordResetPage],
      providers: [
        provideRouter([]),
        { provide: PasswordResetApiService, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: {
            data: of({ mode }),
            queryParamMap: of({ get: () => token }),
            snapshot: {
              data: { mode },
              queryParamMap: { get: () => token },
            },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PasswordResetPage);
    fixture.detectChanges();
    return { fixture, api };
  }

  function fill(fixture: ComponentFixture<PasswordResetPage>, id: string, value: string): void {
    const input = fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function submit(fixture: ComponentFixture<PasswordResetPage>): void {
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  afterEach(() => TestBed.resetTestingModule());

  it('shows the same confirmation after requesting reset instructions', async () => {
    const { fixture, api } = await createPage('request');
    api.request.mockReturnValue(of({ data: { accepted: true } }));
    fill(fixture, 'email', 'admin@example.com');

    submit(fixture);
    fixture.detectChanges();

    expect(api.request).toHaveBeenCalledWith('admin@example.com');
    expect(fixture.nativeElement.textContent).toContain(
      'Si existe una cuenta con ese correo, recibirás instrucciones',
    );
  });

  it('reports an invalid or expired reset link generically', async () => {
    const { fixture, api } = await createPage('complete', 'a'.repeat(43));
    api.complete.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400 })));
    fill(fixture, 'password', 'Nueva-Correcta-2026!');
    fill(fixture, 'passwordConfirmation', 'Nueva-Correcta-2026!');

    submit(fixture);

    expect(api.complete).toHaveBeenCalledWith('a'.repeat(43), 'Nueva-Correcta-2026!');
    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain('El enlace no es válido o expiró');
  });
});
