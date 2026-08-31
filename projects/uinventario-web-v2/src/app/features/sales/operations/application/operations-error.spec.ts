import { ApiError } from '../../../../core/api/api-error';
import { salesOperationError } from './operations-error';

describe('salesOperationError', () => {
  it('turns stock conflicts into actionable operator copy', () => {
    const error = new ApiError(
      'conflict',
      'raw',
      409,
      'CUSTOMER_ORDER_RESERVATION_UNAVAILABLE',
      'request-1',
      true,
    );

    expect(salesOperationError(error, 'fallback')).toContain('existencias');
  });

  it('preserves an unmapped normalized API message and hides unknown failures', () => {
    const apiError = new ApiError(
      'validation',
      'Revisa el teléfono.',
      422,
      'INVALID_PHONE',
      'request-2',
      false,
    );

    expect(salesOperationError(apiError, 'fallback')).toBe('Revisa el teléfono.');
    expect(salesOperationError(new Error('internal'), 'No disponible.')).toBe('No disponible.');
  });
});
