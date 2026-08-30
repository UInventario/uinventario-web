import { Injectable, inject } from '@angular/core';
import { ReportGateway } from '../domain/report.gateway';
import { ReportQuery } from '../domain/report.models';

@Injectable()
export class ReportFacade {
  private readonly gateway = inject(ReportGateway);

  salesCash(query: ReportQuery) {
    return this.gateway.salesCash(query);
  }
  profitability(query: ReportQuery) {
    return this.gateway.profitability(query);
  }
  inventoryActivity(query: ReportQuery) {
    return this.gateway.inventoryActivity(query);
  }
  inventoryMovements(productId: string, query: ReportQuery) {
    return this.gateway.inventoryMovements(productId, query);
  }
  sale(id: string) {
    return this.gateway.sale(id);
  }
  saleReturns(id: string) {
    return this.gateway.saleReturns(id);
  }
}
