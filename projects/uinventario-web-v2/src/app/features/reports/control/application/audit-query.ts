import { ParamMap, Params } from '@angular/router';
import { AuditQuery } from '../domain/control.models';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function auditQueryFrom(params: ParamMap): AuditQuery {
  const page = Number(params.get('page'));
  return {
    q: optional(params.get('q')),
    action: optional(params.get('action')),
    entityType: optional(params.get('entityType')),
    actorId: uuid(params.get('actorId')),
    dateFrom: date(params.get('dateFrom')),
    dateTo: date(params.get('dateTo')),
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: 25,
  };
}

export function auditQueryParams(query: AuditQuery): Params {
  return {
    q: query.q ?? null,
    action: query.action ?? null,
    entityType: query.entityType ?? null,
    actorId: query.actorId ?? null,
    dateFrom: query.dateFrom ?? null,
    dateTo: query.dateTo ?? null,
    page: query.page > 1 ? query.page : null,
  };
}

export function validAuditPeriod(query: Pick<AuditQuery, 'dateFrom' | 'dateTo'>): boolean {
  return !query.dateFrom || !query.dateTo || query.dateFrom <= query.dateTo;
}

export function validUuid(value?: string): boolean {
  return (
    !value ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function optional(value: string | null): string | undefined {
  return value?.trim() || undefined;
}

function uuid(value: string | null): string | undefined {
  const candidate = optional(value);
  return validUuid(candidate) ? candidate : undefined;
}

function date(value: string | null): string | undefined {
  if (!value || !DATE_PATTERN.test(value)) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
    ? value
    : undefined;
}
