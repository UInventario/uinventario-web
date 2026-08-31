import { Observable } from 'rxjs';
import {
  CommerceContract,
  CommerceCredential,
  CommerceCredentialInput,
  CommerceDelivery,
  CommerceOptions,
  IssuedCommerceCredential,
} from './commerce.models';

export abstract class CommerceGateway {
  abstract credentials(): Observable<readonly CommerceCredential[]>;
  abstract deliveries(): Observable<readonly CommerceDelivery[]>;
  abstract contract(): Observable<CommerceContract>;
  abstract options(): Observable<CommerceOptions>;
  abstract create(input: CommerceCredentialInput): Observable<IssuedCommerceCredential>;
  abstract rotate(id: string): Observable<IssuedCommerceCredential>;
  abstract revoke(id: string): Observable<void>;
  abstract replay(deliveryId: string): Observable<CommerceDelivery>;
}
