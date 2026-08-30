import { Routes } from '@angular/router';

export const ADMINISTRATION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./ui/administration-page').then((module) => module.AdministrationPage),
  },
];
