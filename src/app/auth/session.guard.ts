import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { SessionApiService } from './session-api.service';

export const sessionGuard: CanActivateFn = (_route, state) => {
  const sessions = inject(SessionApiService);
  const router = inject(Router);

  return sessions.loadCurrent().pipe(
    map(({ data }) => {
      if (state.url.startsWith('/app') && data.nextStep === 'ONBOARDING') {
        return router.createUrlTree(['/onboarding']);
      }
      if (state.url === '/onboarding' && data.nextStep === 'APPLICATION') {
        return router.createUrlTree(['/app']);
      }
      return true;
    }),
    catchError(() =>
      of(
        router.createUrlTree(['/login'], {
          queryParams: { returnUrl: state.url },
        }),
      ),
    ),
  );
};
