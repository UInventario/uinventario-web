import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';

export type ApiErrorKind =
  | 'unauthenticated'
  | 'forbidden'
  | 'conflict'
  | 'validation'
  | 'server'
  | 'network'
  | 'timeout'
  | 'unknown';

interface ApiErrorBody {
  readonly code?: unknown;
  readonly correlationId?: unknown;
  readonly message?: unknown;
}

const STATUS_COPY: Partial<Record<number, { kind: ApiErrorKind; message: string }>> = {
  401: { kind: 'unauthenticated', message: 'Tu sesión terminó. Inicia sesión nuevamente.' },
  403: { kind: 'forbidden', message: 'No tienes permisos para realizar esta operación.' },
  409: { kind: 'conflict', message: 'Los datos cambiaron. Actualiza la vista e intenta de nuevo.' },
  422: { kind: 'validation', message: 'Revisa los datos ingresados.' },
};

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status: number,
    readonly code: string,
    readonly correlationId: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function normalizeApiError(error: unknown, requestId: string): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof TimeoutError) {
    return new ApiError(
      'timeout',
      'La operación tardó demasiado. Comprueba tu conexión e intenta de nuevo.',
      0,
      'REQUEST_TIMEOUT',
      requestId,
      true,
    );
  }
  if (!(error instanceof HttpErrorResponse)) {
    return new ApiError(
      'unknown',
      'No fue posible completar la operación.',
      0,
      'UNKNOWN_ERROR',
      requestId,
      false,
    );
  }

  const body = isRecord(error.error) ? (error.error as ApiErrorBody) : undefined;
  const correlationId =
    safeString(body?.correlationId) ?? error.headers.get('X-Request-Id') ?? requestId;
  const code = safeString(body?.code) ?? `HTTP_${error.status || 0}`;
  if (error.status === 0) {
    return new ApiError(
      'network',
      'No hay conexión con UInventario. Revisa tu red e intenta de nuevo.',
      0,
      code,
      correlationId,
      true,
    );
  }

  const known = STATUS_COPY[error.status];
  if (known) {
    return new ApiError(
      known.kind,
      error.status === 422 ? (normalizedMessage(body?.message) ?? known.message) : known.message,
      error.status,
      code,
      correlationId,
      error.status === 409,
    );
  }
  if (error.status >= 500) {
    return new ApiError(
      'server',
      'UInventario no pudo completar la operación. Intenta de nuevo más tarde.',
      error.status,
      code,
      correlationId,
      [502, 503, 504].includes(error.status),
    );
  }
  return new ApiError(
    'unknown',
    normalizedMessage(body?.message) ?? 'No fue posible completar la operación.',
    error.status,
    code,
    correlationId,
    false,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 160) : undefined;
}

function normalizedMessage(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const messages = value.filter((item): item is string => typeof item === 'string');
    return messages.length ? messages.join(' ').slice(0, 300) : undefined;
  }
  return safeString(value)?.slice(0, 300);
}
