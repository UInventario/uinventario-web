import { Subject } from 'rxjs';
import { switchSearchRequest } from './search-request.operator';

describe('switchSearchRequest', () => {
  it('cancels the active request when filters change', () => {
    const filters = new Subject<string>();
    const firstRequest = new Subject<string>();
    const secondRequest = new Subject<string>();
    const results: string[] = [];

    const subscription = filters
      .pipe(
        switchSearchRequest((query) => (query === 'first' ? firstRequest : secondRequest), {
          debounceMs: 0,
        }),
      )
      .subscribe((result) => results.push(result));

    filters.next('first');
    expect(firstRequest.observed).toBe(true);
    filters.next('second');
    expect(firstRequest.observed).toBe(false);
    secondRequest.next('current result');
    firstRequest.next('stale result');

    expect(results).toEqual(['current result']);
    subscription.unsubscribe();
  });

  it('does not repeat an equal query', () => {
    const filters = new Subject<{ term: string }>();
    let requests = 0;
    const subscription = filters
      .pipe(
        switchSearchRequest(
          () => {
            requests += 1;
            return new Subject<void>();
          },
          { debounceMs: 0, equals: (previous, current) => previous.term === current.term },
        ),
      )
      .subscribe();

    filters.next({ term: 'sku' });
    filters.next({ term: 'sku' });
    expect(requests).toBe(1);
    subscription.unsubscribe();
  });
});
