import { Observable } from 'rxjs';
import {
  AdapterCapability,
  AdapterCatalogItem,
  AdapterConfiguration,
  AdapterExecution,
  AdapterScenario,
  AdapterUpdate,
  EmailEvent,
  ProviderKey,
  ProviderSummary,
} from './integration.models';

export abstract class IntegrationGateway {
  abstract adapters(): Observable<{
    readonly configurations: readonly AdapterConfiguration[];
    readonly catalog: readonly AdapterCatalogItem[];
  }>;
  abstract executions(): Observable<readonly AdapterExecution[]>;
  abstract emailEvents(): Observable<readonly EmailEvent[]>;
  abstract provider(key: ProviderKey): Observable<ProviderSummary>;
  abstract updateAdapter(input: AdapterUpdate): Observable<AdapterConfiguration>;
  abstract diagnose(
    capability: AdapterCapability,
    scenario: AdapterScenario,
  ): Observable<AdapterExecution>;
}
