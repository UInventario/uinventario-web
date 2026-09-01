import { convertToParamMap } from '@angular/router';
import { auditQueryFrom, auditQueryParams, validAuditPeriod, validUuid } from './audit-query';

describe('audit query', () => {
  it('restores supported filters from the URL', () => {
    expect(
      auditQueryFrom(
        convertToParamMap({
          q: 'ana@example.com',
          action: 'PRODUCT_UPDATED',
          entityType: 'PRODUCT',
          actorId: '11111111-1111-4111-8111-111111111111',
          dateFrom: '2026-08-01',
          dateTo: '2026-08-31',
          page: '3',
        }),
      ),
    ).toEqual({
      q: 'ana@example.com',
      action: 'PRODUCT_UPDATED',
      entityType: 'PRODUCT',
      actorId: '11111111-1111-4111-8111-111111111111',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      page: 3,
      pageSize: 25,
    });
  });

  it('rejects malformed identifiers and impossible dates', () => {
    const query = auditQueryFrom(
      convertToParamMap({ actorId: 'otro-tenant', dateFrom: '2026-02-31', page: '-4' }),
    );
    expect(query.actorId).toBeUndefined();
    expect(query.dateFrom).toBeUndefined();
    expect(query.page).toBe(1);
    expect(validUuid('otro-tenant')).toBe(false);
  });

  it('keeps filters shareable and omits the first page', () => {
    expect(
      auditQueryParams({
        q: 'folio-100',
        actorId: '11111111-1111-4111-8111-111111111111',
        page: 1,
        pageSize: 25,
      }),
    ).toMatchObject({ q: 'folio-100', page: null });
  });

  it('prevents an inverted period', () => {
    expect(validAuditPeriod({ dateFrom: '2026-08-31', dateTo: '2026-08-01' })).toBe(false);
    expect(validAuditPeriod({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })).toBe(true);
  });
});
