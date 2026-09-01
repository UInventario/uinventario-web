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
import { DesktopPeripheralPort } from './core/desktop/desktop-peripheral.port';
import { WebDesktopPeripheralAdapter } from './core/desktop/web-desktop-peripheral.adapter';
import { sessionRefreshInterceptor } from './core/session/session-refresh.interceptor';
import { configuredPrimeUiLicense } from './core/theme/primeui-license';
import { UINVENTARIO_PRESET } from './core/theme/uinventario-preset';

const primeUiLicense = configuredPrimeUiLicense();

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
    WebDesktopPeripheralAdapter,
    { provide: DesktopPeripheralPort, useExisting: WebDesktopPeripheralAdapter },
    provideRouter(routes),
    providePrimeNG({
      ...(primeUiLicense ? { license: primeUiLicense } : {}),
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
