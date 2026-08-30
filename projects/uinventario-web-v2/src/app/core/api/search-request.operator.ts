import { debounceTime, distinctUntilChanged, Observable, OperatorFunction, switchMap } from 'rxjs';

export interface SearchRequestOptions<TQuery> {
  readonly debounceMs?: number;
  readonly equals?: (previous: TQuery, current: TQuery) => boolean;
}

export function switchSearchRequest<TQuery, TResult>(
  request: (query: TQuery) => Observable<TResult>,
  options: SearchRequestOptions<TQuery> = {},
): OperatorFunction<TQuery, TResult> {
  const debounceMs = Math.max(0, options.debounceMs ?? 250);
  return (queries) => {
    const debounced = debounceMs ? queries.pipe(debounceTime(debounceMs)) : queries;
    return debounced.pipe(
      distinctUntilChanged(options.equals),
      switchMap((query) => request(query)),
    );
  };
}
