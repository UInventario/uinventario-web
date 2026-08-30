import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SessionData } from './session.models';

const PUBLIC_IDENTITY_PATHS = ['/login', '/registro', '/recuperar', '/restablecer'];

@Injectable({ providedIn: 'root' })
export class SessionNavigation {
  private readonly router = inject(Router);

  openAuthorizedWorkspace(session: SessionData, requestedUrl: string | null = null): void {
    if (session.nextStep === 'ONBOARDING') {
      void this.router.navigateByUrl('/onboarding');
      return;
    }
    void this.router.navigateByUrl(safeReturnUrl(requestedUrl));
  }

  redirectToLogin(returnUrl: string | null = null, preserveReturnUrl = true): void {
    if (this.router.url.startsWith('/login')) return;
    const queryParams = preserveReturnUrl
      ? { returnUrl: safeReturnUrl(returnUrl ?? this.router.url) }
      : undefined;
    void this.router.navigate(['/login'], { queryParams });
  }
}

export function safeReturnUrl(value: string | null | undefined): string {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    [...value].some((character) => character.charCodeAt(0) < 32)
  ) {
    return '/dashboard';
  }
  const path = value.split(/[?#]/, 1)[0].replace(/\/$/, '') || '/';
  if (PUBLIC_IDENTITY_PATHS.includes(path)) return '/dashboard';
  return value;
}
