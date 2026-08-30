import { ParamMap, Params } from '@angular/router';
import { ReportQuery } from '../domain/report.models';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function reportQueryFrom(params: ParamMap): ReportQuery {
  const page = Number(params.get('page'));
  const status = params.get('status');
  return {
    dateFrom: date(params.get('dateFrom')),
    dateTo: date(params.get('dateTo')),
    branchId: optional(params.get('branchId')),
    cashRegisterId: optional(params.get('cashRegisterId')),
    userId: optional(params.get('userId')),
    warehouseId: optional(params.get('warehouseId')),
    categoryId: optional(params.get('categoryId')),
    product: optional(params.get('product')),
    status: status === 'COMPLETED' || status === 'VOIDED' ? status : 'ALL',
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: 25,
  };
}

export function reportQueryParams(query: ReportQuery): Params {
  return {
    dateFrom: query.dateFrom ?? null,
    dateTo: query.dateTo ?? null,
    branchId: query.branchId ?? null,
    cashRegisterId: query.cashRegisterId ?? null,
    userId: query.userId ?? null,
    warehouseId: query.warehouseId ?? null,
    categoryId: query.categoryId ?? null,
    product: query.product ?? null,
    status: query.status && query.status !== 'ALL' ? query.status : null,
    page: query.page > 1 ? query.page : null,
  };
}

export function validPeriod(dateFrom?: string, dateTo?: string): boolean {
  return !dateFrom || !dateTo || dateFrom <= dateTo;
}

function optional(value: string | null): string | undefined {
  return value?.trim() || undefined;
}

function date(value: string | null): string | undefined {
  return value && DATE_PATTERN.test(value) ? value : undefined;
}
