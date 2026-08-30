import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AppPermission } from './app-permission';
import { AuthorizationService } from './authorization.service';

export function requireAnyPermission(...permissions: readonly AppPermission[]): CanActivateFn {
  return () => {
    const authorization = inject(AuthorizationService);
    if (authorization.hasAny(permissions)) return true;
    return inject(Router).createUrlTree(['/dashboard'], {
      queryParams: { accessDenied: 'true' },
    });
  };
}

export function requireAllPermissions(...permissions: readonly AppPermission[]): CanActivateFn {
  return () => {
    const authorization = inject(AuthorizationService);
    if (authorization.hasAll(permissions)) return true;
    return inject(Router).createUrlTree(['/dashboard'], {
      queryParams: { accessDenied: 'true' },
    });
  };
}
