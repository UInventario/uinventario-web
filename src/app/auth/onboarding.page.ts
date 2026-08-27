import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import {
  CompanyOnboardingData,
  InitialCashRegisterData,
  InitialLocationData,
  OnboardingApiService,
} from './onboarding-api.service';
import { SessionApiService } from './session-api.service';

const ISO_COUNTRY_CODES = `
  AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR
  BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC
  EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK
  HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB
  LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ
  NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW
  SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR
  TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW
`
  .trim()
  .split(/\s+/);

function buildCountryOptions(): Array<{ code: string; name: string }> {
  const names = new Intl.DisplayNames(['es'], { type: 'region' });
  return ISO_COUNTRY_CODES.map((code) => ({
    code,
    name: names.of(code) ?? code,
  })).sort((left, right) => left.name.localeCompare(right.name, 'es'));
}

@Component({
  selector: 'app-onboarding-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './onboarding.page.html',
  styleUrl: './onboarding.page.scss',
})
export class OnboardingPage implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly onboarding = inject(OnboardingApiService);
  private readonly sessions = inject(SessionApiService);
  private readonly router = inject(Router);

  protected readonly session = this.sessions.session;
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly closingSession = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly companySaved = signal(false);
  protected readonly progress = signal<CompanyOnboardingData['progress'] | null>(null);
  protected readonly initialLocation = signal<InitialLocationData | null>(null);
  protected readonly initialCashRegister = signal<InitialCashRegisterData | null>(null);
  protected readonly countries = buildCountryOptions();
  protected readonly form = this.formBuilder.nonNullable.group({
    legalName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(160)]],
    tradeName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    countryCode: ['', [Validators.required, Validators.pattern(/^[A-Z]{2}$/)]],
  });
  protected readonly locationForm = this.formBuilder.nonNullable.group({
    branchName: ['Sucursal Principal', [Validators.required, Validators.minLength(2)]],
    timezone: [Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', Validators.required],
    warehouseName: ['Bodega Principal', [Validators.required, Validators.minLength(2)]],
    locationName: ['Ubicación general', [Validators.required, Validators.minLength(2)]],
  });
  protected readonly cashRegisterForm = this.formBuilder.nonNullable.group({
    name: [
      'Caja Principal',
      [Validators.required, Validators.minLength(2), Validators.maxLength(120)],
    ],
  });

  ngOnInit(): void {
    this.onboarding.getCompany().subscribe({
      next: ({ data }) => {
        this.applyCompany(data);
        if (data.progress.currentStep === 'COMPLETE') {
          this.loading.set(false);
        } else if (data.progress.currentStep === 'BRANCH') {
          this.loadInitialLocation();
        } else {
          this.loading.set(false);
        }
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('No fue posible cargar el progreso del onboarding.');
      },
    });
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    this.companySaved.set(false);
    this.onboarding
      .configureCompany(this.form.getRawValue())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.applyCompany(data);
          if (data.progress.currentStep === 'COMPLETE') {
            this.companySaved.set(true);
          } else {
            this.loadInitialLocation();
          }
        },
        error: (error: HttpErrorResponse) =>
          this.errorMessage.set(
            error.status === 0
              ? 'No pudimos conectar con el servicio. Intenta nuevamente.'
              : 'No fue posible guardar la empresa con esos datos.',
          ),
      });
  }

  protected submitInitialLocation(): void {
    if (this.locationForm.invalid || this.saving()) {
      this.locationForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.errorMessage.set(null);
    this.onboarding
      .configureInitialLocation(this.locationForm.getRawValue())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.initialLocation.set(data);
          this.loadInitialCashRegister();
        },
        error: () => this.errorMessage.set('No fue posible crear la sucursal inicial.'),
      });
  }

  protected submitInitialCashRegister(): void {
    if (this.cashRegisterForm.invalid || this.saving()) {
      this.cashRegisterForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.errorMessage.set(null);
    this.onboarding
      .configureInitialCashRegister(this.cashRegisterForm.getRawValue())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.initialCashRegister.set(data);
          this.sessions.loadCurrent().subscribe({
            next: () => void this.router.navigateByUrl('/app'),
            error: () =>
              this.errorMessage.set('La caja se creó, pero no pudimos actualizar la sesión.'),
          });
        },
        error: () => this.errorMessage.set('No fue posible crear la caja inicial.'),
      });
  }

  protected logout(): void {
    if (this.closingSession()) return;
    this.closingSession.set(true);
    this.sessions
      .logout()
      .pipe(finalize(() => this.closingSession.set(false)))
      .subscribe({ error: () => undefined });
  }

  private applyCompany(data: CompanyOnboardingData): void {
    this.form.setValue({
      legalName: data.company.legalName ?? '',
      tradeName: data.company.tradeName,
      countryCode: data.company.countryCode ?? '',
    });
    this.progress.set(data.progress);
  }

  private loadInitialLocation(): void {
    this.loading.set(true);
    this.onboarding
      .getInitialLocation()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.initialLocation.set(data);
          if (data) {
            this.locationForm.setValue({
              branchName: data.branch.name,
              timezone: data.branch.timezone,
              warehouseName: data.warehouse.name,
              locationName: data.location.name,
            });
            this.loadInitialCashRegister();
          }
        },
        error: () => this.errorMessage.set('No fue posible cargar la sucursal inicial.'),
      });
  }

  private loadInitialCashRegister(): void {
    this.loading.set(true);
    this.onboarding
      .getInitialCashRegister()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.initialCashRegister.set(data);
          if (data) this.cashRegisterForm.setValue({ name: data.cashRegister.name });
        },
        error: () => this.errorMessage.set('No fue posible cargar la caja inicial.'),
      });
  }
}
