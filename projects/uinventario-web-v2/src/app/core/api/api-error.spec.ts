import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { TimeoutError } from 'rxjs';
import { normalizeApiError } from './api-error';

describe('API error normalization', () => {
  it.each([
    [401, 'unauthenticated'],
    [403, 'forbidden'],
    [409, 'conflict'],
    [422, 'validation'],
    [500, 'server'],
  ] as const)('maps HTTP %s to %s', (status, kind) => {
    const error = new HttpErrorResponse({
      status,
      error: { code: 'SAFE_CODE', message: status === 422 ? ['Campo requerido'] : 'detalle' },
      headers: new HttpHeaders({ 'X-Request-Id': 'server-request-id' }),
    });

    const normalized = normalizeApiError(error, 'client-request-id');
    expect(normalized.kind).toBe(kind);
    expect(normalized.code).toBe('SAFE_CODE');
    expect(normalized.correlationId).toBe('server-request-id');
  });

  it('maps connectivity and timeout failures to retryable states', () => {
    const network = normalizeApiError(new HttpErrorResponse({ status: 0 }), 'network-request');
    const timedOut = normalizeApiError(new TimeoutError(), 'timeout-request');

    expect(network).toMatchObject({ kind: 'network', retryable: true });
    expect(timedOut).toMatchObject({ kind: 'timeout', retryable: true });
  });

  it('never exposes an arbitrary server payload as a message', () => {
    const error = new HttpErrorResponse({
      status: 500,
      error: { message: 'password=should-not-leak', stack: 'internal stack' },
    });
    expect(normalizeApiError(error, 'request-id').message).not.toContain('password');
  });
});
