import { OperatorFunction, map } from 'rxjs';

export interface ApiEnvelope<TData, TMeta = ApiMetadata> {
  readonly data: TData;
  readonly meta: TMeta;
}

export interface ApiMetadata {
  readonly apiVersion: string;
  readonly [key: string]: unknown;
}

export interface ApiMapper<TDto, TModel> {
  map(dto: TDto): TModel;
}

export function mapApiData<TDto, TModel, TMeta>(
  mapper: ApiMapper<TDto, TModel>,
): OperatorFunction<ApiEnvelope<TDto, TMeta>, ApiEnvelope<TModel, TMeta>> {
  return map((response) => ({ ...response, data: mapper.map(response.data) }));
}
