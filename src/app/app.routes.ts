import { Routes } from '@angular/router';
import { ApplicationPage } from './auth/application.page';
import { LoginPage } from './auth/login.page';
import { OnboardingPage } from './auth/onboarding.page';
import { RegistrationPage } from './auth/registration.page';
import { sessionGuard } from './auth/session.guard';

export const routes: Routes = [
  { path: 'registro', component: RegistrationPage, title: 'Crear cuenta | UInventario' },
  { path: 'login', component: LoginPage, title: 'Iniciar sesión | UInventario' },
  {
    path: 'onboarding',
    component: OnboardingPage,
    canActivate: [sessionGuard],
    title: 'Configuración inicial | UInventario',
  },
  {
    path: 'app',
    component: ApplicationPage,
    canActivate: [sessionGuard],
    title: 'UInventario',
  },
  { path: '', pathMatch: 'full', redirectTo: 'registro' },
  { path: '**', redirectTo: 'registro' },
];
