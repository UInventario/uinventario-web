import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import { UINVENTARIO_PRESET } from './core/theme/uinventario-preset';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimationsAsync(),
    provideRouter(routes),
    providePrimeNG({
      ripple: true,
      theme: {
        preset: UINVENTARIO_PRESET,
        options: {
          cssLayer: {
            name: 'primeng',
            order: 'theme, base, primeng',
          },
          darkModeSelector: '.uinventario-dark',
        },
      },
    }),
  ],
};
