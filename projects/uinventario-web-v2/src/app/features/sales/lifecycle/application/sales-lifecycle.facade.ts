import { Injectable, inject } from '@angular/core';
import { SalesLifecycleGateway } from '../domain/sales-lifecycle.gateway';
import {
  CreateSaleReturnInput,
  FiscalDocumentType,
  SettleSaleReturnInput,
} from '../domain/sales-lifecycle.models';

@Injectable()
export class SalesLifecycleFacade {
  private readonly gateway = inject(SalesLifecycleGateway);

  listSales(query: Parameters<SalesLifecycleGateway['listSales']>[0]) {
    return this.gateway.listSales(query);
  }
  getSale(id: string) {
    return this.gateway.getSale(id);
  }
  voidSale(id: string, reason: string, key: string) {
    return this.gateway.voidSale(id, reason, key);
  }
  listReturns(saleId: string) {
    return this.gateway.listReturns(saleId);
  }
  createReturn(saleId: string, input: CreateSaleReturnInput, key: string) {
    return this.gateway.createReturn(saleId, input, key);
  }
  settleReturn(saleId: string, returnId: string, input: SettleSaleReturnInput, key: string) {
    return this.gateway.settleReturn(saleId, returnId, input, key);
  }
  reprintReceipt(saleId: string) {
    return this.gateway.reprintReceipt(saleId);
  }
  sendReceipt(saleId: string, email: string) {
    return this.gateway.sendReceipt(saleId, email);
  }
  getFiscal(saleId: string) {
    return this.gateway.getFiscal(saleId);
  }
  issueFiscal(
    saleId: string,
    input: { documentType: FiscalDocumentType; scenario: 'SUCCESS' | 'REJECT' | 'TIMEOUT' },
    key: string,
  ) {
    return this.gateway.issueFiscal(saleId, input, key);
  }
  queryFiscal(saleId: string, key: string) {
    return this.gateway.queryFiscal(saleId, key);
  }
  cancelFiscal(saleId: string, key: string) {
    return this.gateway.cancelFiscal(saleId, key);
  }
  sendFiscal(saleId: string, email: string, key: string) {
    return this.gateway.sendFiscal(saleId, email, key);
  }
  downloadFiscal(saleId: string, kind: 'PDF' | 'XML') {
    return this.gateway.downloadFiscal(saleId, kind);
  }
  listSuspended() {
    return this.gateway.listSuspended();
  }
  resumeSuspended(id: string) {
    return this.gateway.resumeSuspended(id);
  }
  cancelSuspended(id: string) {
    return this.gateway.cancelSuspended(id);
  }
}
