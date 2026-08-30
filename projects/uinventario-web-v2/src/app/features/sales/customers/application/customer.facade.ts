import { Injectable, inject } from '@angular/core';
import { CustomerGateway } from '../domain/customer.gateway';
import {
  CreditInput,
  Customer,
  CustomerInput,
  CustomerQuery,
  LegalHoldInput,
  PrivacyActionInput,
  PrivacyPolicyInput,
} from '../domain/customer.models';

@Injectable()
export class CustomerFacade {
  private readonly gateway = inject(CustomerGateway);

  list(query: CustomerQuery) {
    return this.gateway.list(query);
  }
  get(id: string) {
    return this.gateway.get(id);
  }
  save(input: CustomerInput, customer?: Customer) {
    return customer
      ? this.gateway.update(customer.id, input, customer.version)
      : this.gateway.create(input);
  }
  deactivate(id: string) {
    return this.gateway.deactivate(id);
  }
  history(id: string) {
    return this.gateway.history(id);
  }
  credit(id: string) {
    return this.gateway.credit(id);
  }
  configureCredit(id: string, input: CreditInput) {
    return this.gateway.configureCredit(id, input);
  }
  privacyPolicy() {
    return this.gateway.privacyPolicy();
  }
  updatePrivacyPolicy(input: PrivacyPolicyInput) {
    return this.gateway.updatePrivacyPolicy(input);
  }
  privacyReport(id: string) {
    return this.gateway.privacyReport(id);
  }
  exportPrivacy(id: string) {
    return this.gateway.exportPrivacy(id);
  }
  createLegalHold(id: string, input: LegalHoldInput) {
    return this.gateway.createLegalHold(id, input);
  }
  releaseLegalHold(id: string, input: PrivacyActionInput) {
    return this.gateway.releaseLegalHold(id, input);
  }
  anonymize(id: string, input: PrivacyActionInput) {
    return this.gateway.anonymize(id, input);
  }
}
