import { convertToParamMap } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { reportQueryFrom, reportQueryParams, validPeriod } from './report-query';

describe('report query state', () => {
  it('keeps valid filters and pagination in URL-compatible state', () => {
    const query = reportQueryFrom(
      convertToParamMap({
        dateFrom: '2026-08-01',
        dateTo: '2026-08-30',
        status: 'VOIDED',
        product: 'café',
        page: '3',
      }),
    );
    expect(query).toMatchObject({ status: 'VOIDED', product: 'café', page: 3 });
    expect(reportQueryParams(query)).toMatchObject({
      dateFrom: '2026-08-01',
      dateTo: '2026-08-30',
      status: 'VOIDED',
      product: 'café',
      page: 3,
    });
  });

  it('rejects malformed dates, pages and inverted periods', () => {
    expect(reportQueryFrom(convertToParamMap({ dateFrom: 'bad', page: '-2' }))).toMatchObject({
      dateFrom: undefined,
      page: 1,
    });
    expect(validPeriod('2026-08-30', '2026-08-01')).toBe(false);
  });
});
