import { HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, switchMap } from 'rxjs';
import { ApiClient } from '../../../../core/api/api-client';
import { ApiEnvelope } from '../../../../core/api/api-contracts';
import { SalesLifecycleGateway } from '../domain/sales-lifecycle.gateway';
import {
  CreateSaleReturnInput,
  FiscalArtifactFile,
  FiscalDocumentType,
  ReceiptDelivery,
  SaleDetail,
  SaleFiscalDocument,
  SalePage,
  SaleReceipt,
  SaleReturn,
  SettleSaleReturnInput,
  SuspendedSale,
  SuspendedSaleResume,
} from '../domain/sales-lifecycle.models';

interface SalesResponse {
  readonly data: SalePage['items'];
  readonly meta: { readonly pagination: SalePage['pagination'] };
}

@Injectable()
export class SalesLifecycleApi extends SalesLifecycleGateway {
  private readonly api = inject(ApiClient);

  override listSales(query: Parameters<SalesLifecycleGateway['listSales']>[0]) {
    const params: Record<string, string | number> = { page: query.page, pageSize: query.pageSize };
    if (query.dateFrom) params['dateFrom'] = query.dateFrom;
    if (query.dateTo) params['dateTo'] = query.dateTo;
    return this.api
      .get<SalesResponse>('/pos/sales', { params })
      .pipe(map(({ data, meta }) => ({ items: data, pagination: meta.pagination })));
  }

  override getSale(id: string) {
    return this.data(this.api.get<ApiEnvelope<SaleDetail>>(`/pos/sales/${this.id(id)}`));
  }

  override voidSale(id: string, reason: string, key: string) {
    return this.api
      .post<ApiEnvelope<unknown>, { reason: string }>(
        `/pos/sales/${this.id(id)}/void`,
        { reason },
        { headers: this.key(key) },
      )
      .pipe(switchMap(() => this.getSale(id)));
  }

  override listReturns(saleId: string) {
    return this.data(
      this.api.get<ApiEnvelope<readonly SaleReturn[]>>(`/pos/sales/${this.id(saleId)}/returns`),
    );
  }

  override createReturn(saleId: string, input: CreateSaleReturnInput, key: string) {
    return this.data(
      this.api.post<ApiEnvelope<SaleReturn>, CreateSaleReturnInput>(
        `/pos/sales/${this.id(saleId)}/returns`,
        input,
        { headers: this.key(key) },
      ),
    );
  }

  override settleReturn(
    saleId: string,
    returnId: string,
    input: SettleSaleReturnInput,
    key: string,
  ) {
    return this.data(
      this.api.post<ApiEnvelope<SaleReturn>, SettleSaleReturnInput>(
        `/pos/sales/${this.id(saleId)}/returns/${this.id(returnId)}/settlements`,
        input,
        { headers: this.key(key) },
      ),
    );
  }

  override reprintReceipt(saleId: string) {
    return this.data(
      this.api.post<ApiEnvelope<SaleReceipt>, Record<string, never>>(
        `/pos/sales/${this.id(saleId)}/receipt/reprints`,
        {},
      ),
    );
  }

  override sendReceipt(saleId: string, email: string) {
    return this.api
      .post<
        ApiEnvelope<{ readonly receipt: SaleReceipt; readonly delivery: ReceiptDelivery }>,
        { email: string }
      >(`/pos/sales/${this.id(saleId)}/receipt/deliveries`, { email })
      .pipe(map(({ data }) => data.delivery));
  }

  override getFiscal(saleId: string) {
    return this.data(
      this.api.get<ApiEnvelope<SaleFiscalDocument | null>>(
        `/pos/sales/${this.id(saleId)}/fiscal-document`,
      ),
    );
  }

  override issueFiscal(
    saleId: string,
    input: { documentType: FiscalDocumentType; scenario: 'SUCCESS' | 'REJECT' | 'TIMEOUT' },
    key: string,
  ) {
    return this.data(
      this.api.post<ApiEnvelope<SaleFiscalDocument>, typeof input>(
        `/pos/sales/${this.id(saleId)}/fiscal-document`,
        input,
        { headers: this.key(key) },
      ),
    );
  }

  override queryFiscal(saleId: string, key: string) {
    return this.fiscalAction(saleId, 'queries', key);
  }

  override cancelFiscal(saleId: string, key: string) {
    return this.fiscalAction(saleId, 'cancellations', key);
  }

  override sendFiscal(saleId: string, email: string, key: string) {
    return this.api
      .post<
        ApiEnvelope<{
          readonly document: SaleFiscalDocument;
          readonly delivery: ReceiptDelivery;
        }>,
        { email: string }
      >(
        `/pos/sales/${this.id(saleId)}/fiscal-document/deliveries`,
        { email },
        { headers: this.key(key) },
      )
      .pipe(map(({ data }) => data.delivery));
  }

  override downloadFiscal(saleId: string, kind: 'PDF' | 'XML') {
    return this.data(
      this.api.get<ApiEnvelope<FiscalArtifactFile>>(
        `/pos/sales/${this.id(saleId)}/fiscal-document/artifacts/${kind}`,
      ),
    );
  }

  override listSuspended() {
    return this.data(this.api.get<ApiEnvelope<readonly SuspendedSale[]>>('/pos/suspended-sales'));
  }

  override resumeSuspended(id: string) {
    return this.data(
      this.api.post<ApiEnvelope<SuspendedSaleResume>, Record<string, never>>(
        `/pos/suspended-sales/${this.id(id)}/resume`,
        {},
      ),
    );
  }

  override cancelSuspended(id: string) {
    return this.data(
      this.api.post<ApiEnvelope<SuspendedSale>, Record<string, never>>(
        `/pos/suspended-sales/${this.id(id)}/cancel`,
        {},
      ),
    );
  }

  private fiscalAction(saleId: string, action: string, key: string) {
    return this.data(
      this.api.post<ApiEnvelope<SaleFiscalDocument>, Record<string, never>>(
        `/pos/sales/${this.id(saleId)}/fiscal-document/${action}`,
        {},
        { headers: this.key(key) },
      ),
    );
  }

  private data<T>(request: import('rxjs').Observable<ApiEnvelope<T>>) {
    return request.pipe(map(({ data }) => data));
  }

  private key(value: string): HttpHeaders {
    return new HttpHeaders({ 'Idempotency-Key': value });
  }

  private id(value: string): string {
    return encodeURIComponent(value);
  }
}
