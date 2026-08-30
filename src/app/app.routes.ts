import { Routes } from '@angular/router';
import { LoginPage } from './auth/login.page';
import { OnboardingPage } from './auth/onboarding.page';
import { PasswordResetPage } from './auth/password-reset.page';
import { RegistrationPage } from './auth/registration.page';
import { sessionGuard } from './auth/session.guard';

export const routes: Routes = [
  { path: 'registro', component: RegistrationPage, title: 'Crear cuenta | UInventario' },
  { path: 'login', component: LoginPage, title: 'Iniciar sesión | UInventario' },
  {
    path: 'recuperar',
    component: PasswordResetPage,
    data: { mode: 'request' },
    title: 'Recuperar contraseña | UInventario',
  },
  {
    path: 'restablecer',
    component: PasswordResetPage,
    data: { mode: 'complete' },
    title: 'Restablecer contraseña | UInventario',
  },
  {
    path: 'onboarding',
    component: OnboardingPage,
    canActivate: [sessionGuard],
    title: 'Configuración inicial | UInventario',
  },
  {
    path: 'app/inventory-activity',
    loadComponent: () =>
      import('./inventory/inventory-activity-report.component').then(
        ({ InventoryActivityReportComponent }) => InventoryActivityReportComponent,
      ),
    canActivate: [sessionGuard],
    title: 'Actividad de inventario | UInventario',
  },
  {
    path: 'app',
    loadComponent: () =>
      import('./auth/application.page').then(({ ApplicationPage }) => ApplicationPage),
    canActivate: [sessionGuard],
    title: 'UInventario',
  },
  { path: '', pathMatch: 'full', redirectTo: 'registro' },
  { path: '**', redirectTo: 'registro' },
];
