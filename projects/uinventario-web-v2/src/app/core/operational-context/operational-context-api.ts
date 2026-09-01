import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../api/api-client';
import { OperationalBranchesResponse } from './operational-context.models';

@Injectable({ providedIn: 'root' })
export class OperationalContextApi {
  private readonly api = inject(ApiClient);

  listBranches() {
    return this.api.get<OperationalBranchesResponse>('/organization/branches');
  }
}
