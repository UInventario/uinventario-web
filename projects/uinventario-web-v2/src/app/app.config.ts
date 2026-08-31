import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideServiceWorker } from '@angular/service-worker';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import { apiContextInterceptor } from './core/api/api-context.interceptor';
import { apiResilienceInterceptor } from './core/api/api-resilience.interceptor';
import { ApiRuntimeConfig } from './core/api/api-runtime-config';
import { sessionRefreshInterceptor } from './core/session/session-refresh.interceptor';
import { UINVENTARIO_PRESET } from './core/theme/uinventario-preset';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimationsAsync(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideHttpClient(
      withInterceptors([
        apiContextInterceptor,
        sessionRefreshInterceptor,
        apiResilienceInterceptor,
      ]),
    ),
    provideAppInitializer(() => inject(ApiRuntimeConfig).load()),
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
