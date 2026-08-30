import { inject, Injectable } from '@angular/core';
import { IdentityGateway, RegistrationInput } from '../domain/identity.gateway';

@Injectable()
export class IdentityFacade {
  private readonly gateway = inject(IdentityGateway);

  register(input: RegistrationInput, idempotencyKey: string) {
    return this.gateway.register(
      {
        organizationName: input.organizationName.trim(),
        email: input.email.trim().toLowerCase(),
        password: input.password,
      },
      idempotencyKey,
    );
  }

  requestPasswordReset(email: string) {
    return this.gateway.requestPasswordReset(email.trim().toLowerCase());
  }

  completePasswordReset(token: string, password: string) {
    return this.gateway.completePasswordReset(token, password);
  }
}
