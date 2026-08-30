import { Provider } from '@angular/core';
import { Routes } from '@angular/router';
import { IdentityFacade } from './application/identity.facade';
import { IdentityApi } from './data/identity-api.service';
import { IdentityGateway } from './domain/identity.gateway';

const IDENTITY_PROVIDERS: Provider[] = [
  IdentityApi,
  IdentityFacade,
  { provide: IdentityGateway, useExisting: IdentityApi },
];

export const REGISTRATION_ROUTES: Routes = [
  {
    path: '',
    providers: IDENTITY_PROVIDERS,
    loadComponent: () =>
      import('./ui/registration-page/registration-page').then((module) => module.RegistrationPage),
  },
];

export const PASSWORD_RESET_REQUEST_ROUTES: Routes = [
  {
    path: '',
    data: { mode: 'request' },
    providers: IDENTITY_PROVIDERS,
    loadComponent: () =>
      import('./ui/password-reset-page/password-reset-page').then(
        (module) => module.PasswordResetPage,
      ),
  },
];

export const PASSWORD_RESET_COMPLETE_ROUTES: Routes = [
  {
    path: '',
    data: { mode: 'complete' },
    providers: IDENTITY_PROVIDERS,
    loadComponent: () =>
      import('./ui/password-reset-page/password-reset-page').then(
        (module) => module.PasswordResetPage,
      ),
  },
];
