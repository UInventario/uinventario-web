import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiClient } from '../../../core/api/api-client';
import { ApiEnvelope } from '../../../core/api/api-contracts';
import { AccessGateway } from '../domain/access.gateway';
import {
  AccessBranch,
  AccessRole,
  AccessUser,
  AccessUserAssignment,
  AccessUserInput,
  OperationalPermission,
} from '../domain/access.models';

type Response<T> = ApiEnvelope<T>;

@Injectable()
export class AccessApi extends AccessGateway {
  private readonly api = inject(ApiClient);

  override listRoles() {
    return this.data<readonly AccessRole[]>(this.api.get('/access/roles'));
  }

  override listUsers() {
    return this.data<readonly AccessUser[]>(this.api.get('/access/users'));
  }

  override listBranches() {
    return this.data<readonly AccessBranch[]>(this.api.get('/organization/branches'));
  }

  override createRole(name: string, permissions: readonly OperationalPermission[]) {
    return this.data<AccessRole>(this.api.post('/access/roles', { name, permissions }));
  }

  override createUser(input: AccessUserInput) {
    return this.data<AccessUser>(this.api.post('/access/users', input));
  }

  override updateUser(id: string, input: AccessUserAssignment) {
    return this.data<AccessUser>(this.api.patch(`/access/users/${encodeURIComponent(id)}`, input));
  }

  override retireUser(id: string, confirmationEmail: string) {
    return this.data<AccessUser>(
      this.api.post(`/access/users/${encodeURIComponent(id)}/retirement`, {
        confirmationEmail,
      }),
    );
  }

  private data<T>(request: Observable<unknown>) {
    return (request as Observable<Response<T>>).pipe(map(({ data }) => data));
  }
}
