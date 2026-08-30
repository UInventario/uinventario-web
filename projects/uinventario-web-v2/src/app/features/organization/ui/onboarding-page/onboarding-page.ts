import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { SessionManager } from '../../../../core/session/session-manager';
import { SessionNavigation } from '../../../../core/session/session-navigation';
import { SessionState } from '../../../../core/session/session-state';
import { OrganizationFacade } from '../../application/organization.facade';
import { countryOptions, timezoneOptions } from '../../application/organization-options';
import { InitialCashRegister, InitialLocation } from '../../domain/organization.models';

type OnboardingStep = 'COMPANY' | 'LOCATION' | 'REGISTER';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, ReactiveFormsModule, RouterLink],
  selector: 'ui-onboarding-page',
  styleUrls: ['./onboarding-page.scss', './onboarding-mobile.scss'],
  templateUrl: './onboarding-page.html',
})
export class OnboardingPage implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly organization = inject(OrganizationFacade);
  private readonly sessionManager = inject(SessionManager);
  private readonly sessionNavigation = inject(SessionNavigation);
  private readonly sessionState = inject(SessionState);

  protected readonly countries = countryOptions();
  protected readonly timezones = timezoneOptions();
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly loggingOut = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly step = signal<OnboardingStep>('COMPANY');
  protected readonly initialLocation = signal<InitialLocation | null>(null);
  protected readonly initialCashRegister = signal<InitialCashRegister | null>(null);
  protected readonly companyForm = this.formBuilder.nonNullable.group({
    legalName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(160)]],
    tradeName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    countryCode: ['', [Validators.required, Validators.pattern(/^[A-Z]{2}$/)]],
  });
  protected readonly locationForm = this.formBuilder.nonNullable.group({
    branchName: [
      'Sucursal principal',
      [Validators.required, Validators.minLength(2), Validators.maxLength(120)],
    ],
    timezone: [this.defaultTimezone(), Validators.required],
    warehouseName: [
      'Bodega principal',
      [Validators.required, Validators.minLength(2), Validators.maxLength(120)],
    ],
    locationName: [
      'Ubicación general',
      [Validators.required, Validators.minLength(2), Validators.maxLength(120)],
    ],
  });
  protected readonly registerForm = this.formBuilder.nonNullable.group({
    name: [
      'Caja principal',
      [Validators.required, Validators.minLength(2), Validators.maxLength(120)],
    ],
  });

  ngOnInit(): void {
    if (this.sessionState.session()?.nextStep === 'APPLICATION') {
      this.sessionNavigation.openAuthorizedWorkspace(this.sessionState.session()!);
      return;
    }
    this.loadProgress();
  }

  protected saveCompany(): void {
    if (this.companyForm.invalid || this.saving()) {
      this.companyForm.markAllAsTouched();
      return;
    }
    this.runSave(this.organization.configureCompany(this.companyForm.getRawValue()), () =>
      this.step.set('LOCATION'),
    );
  }

  protected saveLocation(): void {
    if (this.locationForm.invalid || this.saving()) {
      this.locationForm.markAllAsTouched();
      return;
    }
    this.runSave(
      this.organization.configureInitialLocation(this.locationForm.getRawValue()),
      (location) => {
        this.initialLocation.set(location);
        this.step.set('REGISTER');
      },
    );
  }

  protected saveRegister(): void {
    if (this.registerForm.invalid || this.saving()) {
      this.registerForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.errorMessage.set(null);
    this.organization.configureInitialCashRegister(this.registerForm.getRawValue().name).subscribe({
      next: (register) => {
        this.initialCashRegister.set(register);
        this.sessionManager
          .refreshOnce(true)
          .pipe(finalize(() => this.saving.set(false)))
          .subscribe({
            next: (session) => this.sessionNavigation.openAuthorizedWorkspace(session),
            error: (error: unknown) => this.showError(error, true),
          });
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.showError(error);
      },
    });
  }

  protected logout(): void {
    if (this.loggingOut()) return;
    this.loggingOut.set(true);
    this.sessionManager
      .logout()
      .pipe(finalize(() => this.loggingOut.set(false)))
      .subscribe({ error: () => undefined });
  }

  protected stepNumber(candidate: OnboardingStep): number {
    return { COMPANY: 1, LOCATION: 2, REGISTER: 3 }[candidate];
  }

  private loadProgress(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.organization.getCompany().subscribe({
      next: (company) => {
        this.companyForm.setValue({
          legalName: company.company.legalName ?? '',
          tradeName: company.company.tradeName,
          countryCode: company.company.countryCode ?? '',
        });
        if (company.progress.currentStep === 'COMPANY') {
          this.step.set('COMPANY');
          this.loading.set(false);
          return;
        }
        this.loadOperation();
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.showError(error);
      },
    });
  }

  private loadOperation(): void {
    forkJoin({
      location: this.organization.getInitialLocation(),
      register: this.organization.getInitialCashRegister(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ location, register }) => {
          this.initialLocation.set(location);
          this.initialCashRegister.set(register);
          if (location) {
            this.locationForm.setValue({
              branchName: location.branch.name,
              timezone: location.branch.timezone,
              warehouseName: location.warehouse.name,
              locationName: location.location.name,
            });
          }
          if (register) this.registerForm.setValue({ name: register.cashRegister.name });
          this.step.set(location ? 'REGISTER' : 'LOCATION');
        },
        error: (error: unknown) => this.showError(error),
      });
  }

  private runSave<T>(request: import('rxjs').Observable<T>, onSuccess: (value: T) => void): void {
    this.saving.set(true);
    this.errorMessage.set(null);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: onSuccess,
      error: (error: unknown) => this.showError(error),
    });
  }

  private showError(error: unknown, sessionRefresh = false): void {
    if (sessionRefresh) {
      this.errorMessage.set(
        'La operación quedó configurada, pero no pudimos actualizar la sesión. Intenta continuar nuevamente.',
      );
      return;
    }
    if (error instanceof ApiError) {
      if (error.kind === 'validation') {
        this.errorMessage.set('Revisa los campos marcados e intenta de nuevo.');
        return;
      }
      if (error.kind === 'conflict') {
        this.errorMessage.set('La configuración ya existe o cambió. Recarga el progreso.');
        return;
      }
      this.errorMessage.set(error.message);
      return;
    }
    this.errorMessage.set('No fue posible guardar la configuración inicial.');
  }

  private defaultTimezone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  }
}
