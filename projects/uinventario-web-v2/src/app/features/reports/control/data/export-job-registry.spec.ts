import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { SessionState } from '../../../../core/session/session-state';
import { ExportJobRegistry } from './export-job-registry';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number {
    return this.values.size;
  }
  clear(): void {
    this.values.clear();
  }
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('ExportJobRegistry', () => {
  const storage = new MemoryStorage();
  let tenantId = 'tenant-a';
  let userId = 'user-a';
  let registry: ExportJobRegistry;

  beforeEach(() => {
    storage.clear();
    tenantId = 'tenant-a';
    userId = 'user-a';
    TestBed.configureTestingModule({
      providers: [
        ExportJobRegistry,
        { provide: DOCUMENT, useValue: { defaultView: { localStorage: storage } } },
        {
          provide: SessionState,
          useValue: {
            session: () => ({ tenant: { id: tenantId }, user: { id: userId } }),
          },
        },
      ],
    });
    registry = TestBed.inject(ExportJobRegistry);
  });

  it('isolates job identifiers by tenant and user', () => {
    const id = uuid(1);
    registry.remember(id);
    expect(registry.list()).toEqual([id]);

    tenantId = 'tenant-b';
    expect(registry.list()).toEqual([]);
    registry.remember(uuid(2));

    tenantId = 'tenant-a';
    expect(registry.list()).toEqual([id]);
    userId = 'user-b';
    expect(registry.list()).toEqual([]);
  });

  it('keeps only validated, recent identifiers', () => {
    for (let index = 1; index <= 24; index += 1) registry.remember(uuid(index));
    registry.remember('not-an-export-id');

    expect(registry.list()).toHaveLength(20);
    expect(registry.list()[0]).toBe(uuid(24));
    expect(registry.list()).not.toContain('not-an-export-id');
  });
});

function uuid(value: number): string {
  return `00000000-0000-4000-8000-${value.toString().padStart(12, '0')}`;
}
