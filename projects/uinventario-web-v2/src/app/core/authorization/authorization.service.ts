import { Injectable, computed, inject } from '@angular/core';
import { SessionState } from '../session/session-state';
import { AppPermission } from './app-permission';

@Injectable({ providedIn: 'root' })
export class AuthorizationService {
  private readonly sessions = inject(SessionState);

  readonly permissions = computed(() => new Set(this.sessions.session()?.user.permissions ?? []));

  has(permission: AppPermission): boolean {
    return this.permissions().has(permission);
  }

  hasAny(permissions: readonly AppPermission[]): boolean {
    return permissions.length === 0 || permissions.some((permission) => this.has(permission));
  }

  hasAll(permissions: readonly AppPermission[]): boolean {
    return permissions.every((permission) => this.has(permission));
  }
}
