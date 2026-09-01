import { Provider } from '@angular/core';
import { Routes } from '@angular/router';
import { requireAnyPermission } from '../../core/authorization/permission.guard';
import { OrganizationFacade } from './application/organization.facade';
import { OrganizationApi } from './data/organization-api.service';
import { OrganizationGateway } from './domain/organization.gateway';

const ORGANIZATION_PROVIDERS: Provider[] = [
  OrganizationApi,
  OrganizationFacade,
  { provide: OrganizationGateway, useExisting: OrganizationApi },
];

export const ONBOARDING_ROUTES: Routes = [
  {
    path: '',
    providers: ORGANIZATION_PROVIDERS,
    loadComponent: () =>
      import('./ui/onboarding-page/onboarding-page').then((module) => module.OnboardingPage),
  },
];

export const ORGANIZATION_ADMIN_ROUTES: Routes = [
  {
    path: '',
    canActivate: [requireAnyPermission('TENANT_MANAGE')],
    providers: ORGANIZATION_PROVIDERS,
    loadComponent: () =>
      import('./ui/organization-page/organization-page').then((module) => module.OrganizationPage),
  },
];
