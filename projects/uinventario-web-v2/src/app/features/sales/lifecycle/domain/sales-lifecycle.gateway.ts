import { Observable } from 'rxjs';
import {
  CreateSaleReturnInput,
  FiscalDocumentType,
  FiscalArtifactFile,
  ReceiptDelivery,
  SaleDetail,
  SaleFiscalDocument,
  SalePage,
  SaleReceipt,
  SaleReturn,
  SettleSaleReturnInput,
  SuspendedSale,
  SuspendedSaleResume,
} from './sales-lifecycle.models';

export abstract class SalesLifecycleGateway {
  abstract listSales(query: {
    page: number;
    pageSize: number;
    dateFrom?: string;
    dateTo?: string;
  }): Observable<SalePage>;
  abstract getSale(id: string): Observable<SaleDetail>;
  abstract voidSale(id: string, reason: string, key: string): Observable<SaleDetail>;
  abstract listReturns(saleId: string): Observable<readonly SaleReturn[]>;
  abstract createReturn(
    saleId: string,
    input: CreateSaleReturnInput,
    key: string,
  ): Observable<SaleReturn>;
  abstract settleReturn(
    saleId: string,
    returnId: string,
    input: SettleSaleReturnInput,
    key: string,
  ): Observable<SaleReturn>;
  abstract reprintReceipt(saleId: string): Observable<SaleReceipt>;
  abstract sendReceipt(saleId: string, email: string): Observable<ReceiptDelivery>;
  abstract getFiscal(saleId: string): Observable<SaleFiscalDocument | null>;
  abstract issueFiscal(
    saleId: string,
    input: { documentType: FiscalDocumentType; scenario: 'SUCCESS' | 'REJECT' | 'TIMEOUT' },
    key: string,
  ): Observable<SaleFiscalDocument>;
  abstract queryFiscal(saleId: string, key: string): Observable<SaleFiscalDocument>;
  abstract cancelFiscal(saleId: string, key: string): Observable<SaleFiscalDocument>;
  abstract sendFiscal(saleId: string, email: string, key: string): Observable<ReceiptDelivery>;
  abstract downloadFiscal(saleId: string, kind: 'PDF' | 'XML'): Observable<FiscalArtifactFile>;
  abstract listSuspended(): Observable<readonly SuspendedSale[]>;
  abstract resumeSuspended(id: string): Observable<SuspendedSaleResume>;
  abstract cancelSuspended(id: string): Observable<SuspendedSale>;
}
