import { firstValueFrom, of } from 'rxjs';
import { ApiEnvelope, mapApiData } from './api-contracts';

interface ProductDto {
  readonly unit_price: number;
}

interface ProductModel {
  readonly unitPrice: number;
}

describe('API contracts', () => {
  it('maps transport DTOs without coupling them to the consuming model', async () => {
    const response: ApiEnvelope<ProductDto> = {
      data: { unit_price: 1250 },
      meta: { apiVersion: '1' },
    };
    const mapped = await firstValueFrom(
      of(response).pipe(mapApiData({ map: (dto) => ({ unitPrice: dto.unit_price }) })),
    );

    expect(mapped.data).toEqual({ unitPrice: 1250 } satisfies ProductModel);
    expect(mapped.meta).toBe(response.meta);
  });
});
