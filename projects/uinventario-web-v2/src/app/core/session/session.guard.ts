import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { SessionManager } from './session-manager';
import { SessionNavigation } from './session-navigation';

export const sessionGuard: CanActivateFn = (_route, state) => {
  const manager = inject(SessionManager);
  const navigation = inject(SessionNavigation);
  const router = inject(Router);

  return manager.restore().pipe(
    map((session) => {
      if (session.nextStep === 'ONBOARDING') {
        navigation.openAuthorizedWorkspace(session);
        return false;
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
