import { ReportQuery } from '../domain/report.models';

type ReportEndpoint = 'salesCash' | 'profitability' | 'inventory' | 'inventoryMovements';
type OptionalQueryKey = Exclude<keyof ReportQuery, 'page' | 'pageSize'>;

const FIELDS: Readonly<Record<ReportEndpoint, readonly OptionalQueryKey[]>> = {
  salesCash: ['dateFrom', 'dateTo', 'branchId', 'cashRegisterId', 'userId', 'status'],
  profitability: ['dateFrom', 'dateTo', 'branchId', 'cashRegisterId', 'userId'],
  inventory: ['dateFrom', 'dateTo', 'branchId', 'warehouseId', 'categoryId', 'product'],
  inventoryMovements: ['dateFrom', 'dateTo', 'branchId', 'warehouseId'],
};

export function reportApiParams(
  query: ReportQuery,
  endpoint: ReportEndpoint,
): Record<string, string | number> {
  const params: Record<string, string | number> = { page: query.page, pageSize: query.pageSize };
  for (const key of FIELDS[endpoint]) {
    const value = query[key];
    if (value) params[key] = value;
  }
  return params;
}
