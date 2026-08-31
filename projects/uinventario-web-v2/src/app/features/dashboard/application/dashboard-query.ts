import { DASHBOARD_WIDGETS, DashboardQuery, DashboardWidget } from '../domain/dashboard.models';

interface QueryValues {
  get(name: string): string | null;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function defaultDashboardPeriod(
  now = new Date(),
): Pick<DashboardQuery, 'dateFrom' | 'dateTo'> {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  return { dateFrom: localDate(start), dateTo: localDate(end) };
}

export function dashboardQueryFrom(values: QueryValues, now = new Date()): DashboardQuery {
  const fallback = defaultDashboardPeriod(now);
  const dateFrom = validDate(values.get('from')) ?? fallback.dateFrom;
  const dateTo = validDate(values.get('to')) ?? fallback.dateTo;
  const widgetParam = values.get('widgets');
  const requested = (widgetParam ?? '')
    .split(',')
    .filter((value): value is DashboardWidget =>
      DASHBOARD_WIDGETS.includes(value as DashboardWidget),
    );
  return {
    dateFrom: dateFrom <= dateTo ? dateFrom : fallback.dateFrom,
    dateTo: dateFrom <= dateTo ? dateTo : fallback.dateTo,
    widgets: widgetParam === null ? DASHBOARD_WIDGETS : [...new Set(requested)],
  };
}

export function dashboardQueryParams(query: DashboardQuery): Record<string, string> {
  return { from: query.dateFrom, to: query.dateTo, widgets: query.widgets.join(',') };
}

function validDate(value: string | null): string | null {
  if (!value || !DATE_PATTERN.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return localDate(parsed) === value ? value : null;
}

function localDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}
