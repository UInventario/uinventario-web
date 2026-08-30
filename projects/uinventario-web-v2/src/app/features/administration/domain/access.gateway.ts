import { Observable } from 'rxjs';
import {
  AccessBranch,
  AccessRole,
  AccessUser,
  AccessUserAssignment,
  AccessUserInput,
  OperationalPermission,
} from './access.models';

export abstract class AccessGateway {
  abstract listRoles(): Observable<readonly AccessRole[]>;
  abstract listUsers(): Observable<readonly AccessUser[]>;
  abstract listBranches(): Observable<readonly AccessBranch[]>;
  abstract createRole(
    name: string,
    permissions: readonly OperationalPermission[],
  ): Observable<AccessRole>;
  abstract createUser(input: AccessUserInput): Observable<AccessUser>;
  abstract updateUser(id: string, input: AccessUserAssignment): Observable<AccessUser>;
  abstract retireUser(id: string, confirmationEmail: string): Observable<AccessUser>;
}
