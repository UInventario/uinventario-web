import { Observable } from 'rxjs';

export interface RegistrationInput {
  readonly organizationName: string;
  readonly email: string;
  readonly password: string;
}

export interface RegistrationResult {
  readonly tenantId: string;
  readonly tenantName: string;
  readonly userId: string;
  readonly email: string;
}

export abstract class IdentityGateway {
  abstract register(
    input: RegistrationInput,
    idempotencyKey: string,
  ): Observable<RegistrationResult>;
  abstract requestPasswordReset(email: string): Observable<void>;
  abstract completePasswordReset(token: string, password: string): Observable<void>;
}
