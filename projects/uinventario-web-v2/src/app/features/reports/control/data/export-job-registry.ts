import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { SessionState } from '../../../../core/session/session-state';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_JOBS = 20;

@Injectable()
export class ExportJobRegistry {
  private readonly document = inject(DOCUMENT);
  private readonly sessions = inject(SessionState);

  list(): readonly string[] {
    const storage = this.storage();
    if (!storage) return [];
    try {
      const value: unknown = JSON.parse(storage.getItem(this.key()) ?? '[]');
      return Array.isArray(value)
        ? [
            ...new Set(
              value.filter((id): id is string => typeof id === 'string' && UUID_PATTERN.test(id)),
            ),
          ].slice(0, MAX_JOBS)
        : [];
    } catch {
      return [];
    }
  }

  remember(id: string): void {
    if (!UUID_PATTERN.test(id)) return;
    this.write([id, ...this.list().filter((candidate) => candidate !== id)].slice(0, MAX_JOBS));
  }

  forget(id: string): void {
    this.write(this.list().filter((candidate) => candidate !== id));
  }

  private write(ids: readonly string[]): void {
    try {
      this.storage()?.setItem(this.key(), JSON.stringify(ids));
    } catch {
      // The server remains authoritative when private browsing disables storage.
    }
  }

  private storage(): Storage | null {
    try {
      return this.document.defaultView?.localStorage ?? null;
    } catch {
      return null;
    }
  }

  private key(): string {
    const session = this.sessions.session();
    if (!session) return 'uinventario:data-exports:anonymous';
    return `uinventario:data-exports:${session.tenant.id}:${session.user.id}`;
  }
}
