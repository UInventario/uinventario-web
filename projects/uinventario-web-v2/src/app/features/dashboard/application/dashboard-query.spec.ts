import { dashboardQueryFrom, dashboardQueryParams } from './dashboard-query';

function params(values: Record<string, string>) {
  return { get: (name: string) => values[name] ?? null };
}

describe('dashboard query state', () => {
  const now = new Date(2026, 7, 30, 12);

  it('restores period and visible widgets from the URL', () => {
    expect(
      dashboardQueryFrom(
        params({ from: '2026-08-01', to: '2026-08-15', widgets: 'sales,stock,sales' }),
        now,
      ),
    ).toEqual({
      dateFrom: '2026-08-01',
      dateTo: '2026-08-15',
      widgets: ['sales', 'stock'],
    });
  });

  it('uses a stable seven-day period when URL values are missing or inverted', () => {
    expect(dashboardQueryFrom(params({ from: '2026-09-01', to: '2026-08-01' }), now)).toEqual({
      dateFrom: '2026-08-24',
      dateTo: '2026-08-30',
      widgets: ['sales', 'stock', 'purchases', 'forecast', 'notifications'],
    });
  });

  it('serializes all user choices back into shareable query parameters', () => {
    expect(
      dashboardQueryParams({
        dateFrom: '2026-08-01',
        dateTo: '2026-08-30',
        widgets: ['sales', 'notifications'],
      }),
    ).toEqual({
      from: '2026-08-01',
      to: '2026-08-30',
      widgets: 'sales,notifications',
    });
  });

  it('preserves a deliberately empty widget selection and rejects impossible dates', () => {
    expect(
      dashboardQueryFrom(params({ from: '2026-02-31', to: '2026-08-30', widgets: '' }), now),
    ).toEqual({ dateFrom: '2026-08-24', dateTo: '2026-08-30', widgets: [] });
  });
});
