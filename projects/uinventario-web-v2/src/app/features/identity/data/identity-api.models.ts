import { ApiEnvelope } from '../../../core/api/api-contracts';

export interface RegistrationRequestDto {
  readonly organizationName: string;
  readonly email: string;
  readonly password: string;
}

export type RegistrationResponseDto = ApiEnvelope<{
  readonly tenant: { readonly id: string; readonly name: string };
  readonly user: { readonly id: string; readonly email: string };
  readonly nextStep: 'LOGIN';
}>;

export type PasswordResetRequestResponseDto = ApiEnvelope<{ readonly accepted: true }>;
export type PasswordResetCompleteResponseDto = ApiEnvelope<{ readonly reset: true }>;
