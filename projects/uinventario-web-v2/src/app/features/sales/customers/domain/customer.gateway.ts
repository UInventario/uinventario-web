import { Observable } from 'rxjs';
import {
  CreditInput,
  Customer,
  CustomerCreditStatement,
  CustomerHistoryPage,
  CustomerInput,
  CustomerPage,
  CustomerPrivacyReport,
  CustomerQuery,
  LegalHoldInput,
  PrivacyActionInput,
  PrivacyLegalHold,
  PrivacyPolicy,
  PrivacyPolicyInput,
} from './customer.models';

export abstract class CustomerGateway {
  abstract list(query: CustomerQuery): Observable<CustomerPage>;
  abstract get(id: string): Observable<Customer>;
  abstract create(input: CustomerInput): Observable<Customer>;
  abstract update(id: string, input: CustomerInput, version: number): Observable<Customer>;
  abstract deactivate(id: string): Observable<Customer>;
  abstract history(id: string): Observable<CustomerHistoryPage>;
  abstract credit(id: string): Observable<CustomerCreditStatement>;
  abstract configureCredit(id: string, input: CreditInput): Observable<Customer>;
  abstract privacyPolicy(): Observable<PrivacyPolicy>;
  abstract updatePrivacyPolicy(input: PrivacyPolicyInput): Observable<PrivacyPolicy>;
  abstract privacyReport(id: string): Observable<CustomerPrivacyReport>;
  abstract exportPrivacy(id: string): Observable<Blob>;
  abstract createLegalHold(id: string, input: LegalHoldInput): Observable<PrivacyLegalHold>;
  abstract releaseLegalHold(
    id: string,
    input: PrivacyActionInput,
  ): Observable<{ released: boolean }>;
  abstract anonymize(id: string, input: PrivacyActionInput): Observable<{ anonymized: boolean }>;
}
