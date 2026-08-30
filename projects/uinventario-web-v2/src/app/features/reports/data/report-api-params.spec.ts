import { reportApiParams } from './report-api-params';

const query = {
  dateFrom: '2026-08-01',
  dateTo: '2026-08-30',
  branchId: 'branch-1',
  cashRegisterId: 'register-1',
  userId: 'user-1',
  warehouseId: 'warehouse-1',
  categoryId: 'category-1',
  product: 'café',
  status: 'COMPLETED' as const,
  page: 2,
  pageSize: 25,
};

describe('reportApiParams', () => {
  it('sends only sales and cash filters to the sales endpoint', () => {
    expect(reportApiParams(query, 'salesCash')).toEqual({
      page: 2,
      pageSize: 25,
      dateFrom: '2026-08-01',
      dateTo: '2026-08-30',
      branchId: 'branch-1',
      cashRegisterId: 'register-1',
      userId: 'user-1',
      status: 'COMPLETED',
    });
  });

  it('does not leak sales filters into inventory endpoints', () => {
    expect(reportApiParams(query, 'inventory')).toEqual({
      page: 2,
      pageSize: 25,
      dateFrom: '2026-08-01',
      dateTo: '2026-08-30',
      branchId: 'branch-1',
      warehouseId: 'warehouse-1',
      categoryId: 'category-1',
      product: 'café',
    });
    expect(reportApiParams(query, 'inventoryMovements')).toEqual({
      page: 2,
      pageSize: 25,
      dateFrom: '2026-08-01',
      dateTo: '2026-08-30',
      branchId: 'branch-1',
      warehouseId: 'warehouse-1',
    });
  });

  it('omits status from profitability requests', () => {
    expect(reportApiParams(query, 'profitability')).not.toHaveProperty('status');
  });
});
