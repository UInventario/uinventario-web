import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./shell/visual-system-page/visual-system-page').then(
        (module) => module.VisualSystemPage,
      ),
  },
];
