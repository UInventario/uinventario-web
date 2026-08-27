import { Routes } from '@angular/router';
import { LoginPage } from './auth/login.page';
import { RegistrationPage } from './auth/registration.page';

export const routes: Routes = [
  { path: 'registro', component: RegistrationPage, title: 'Crear cuenta | UInventario' },
  { path: 'login', component: LoginPage, title: 'Iniciar sesión | UInventario' },
  { path: '', pathMatch: 'full', redirectTo: 'registro' },
  { path: '**', redirectTo: 'registro' },
];
