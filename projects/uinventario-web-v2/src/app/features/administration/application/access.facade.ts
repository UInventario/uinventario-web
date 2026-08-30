import { Injectable, inject } from '@angular/core';
import { forkJoin, map } from 'rxjs';
import { AccessGateway } from '../domain/access.gateway';
import {
  AccessSnapshot,
  AccessUserAssignment,
  AccessUserInput,
  OperationalPermission,
} from '../domain/access.models';

@Injectable()
export class AccessFacade {
  private readonly gateway = inject(AccessGateway);

  load() {
    return forkJoin({
      roles: this.gateway.listRoles(),
      users: this.gateway.listUsers(),
      branches: this.gateway.listBranches(),
    }).pipe(map((snapshot) => snapshot satisfies AccessSnapshot));
  }

  createRole(name: string, permissions: readonly OperationalPermission[]) {
    return this.gateway.createRole(name.trim(), [...permissions].sort());
  }

  createUser(input: AccessUserInput) {
    return this.gateway.createUser({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      ...this.assignment(input),
    });
  }

  updateUser(id: string, input: AccessUserAssignment) {
    return this.gateway.updateUser(id, this.assignment(input));
  }

  retireUser(id: string, confirmationEmail: string) {
    return this.gateway.retireUser(id, confirmationEmail.trim().toLowerCase());
  }

  private assignment(input: AccessUserAssignment): AccessUserAssignment {
    return {
      roleIds: [...new Set(input.roleIds)],
      branchIds: [...new Set(input.branchIds)],
      cashRegisterIds: [...new Set(input.cashRegisterIds)],
    };
  }
}
