import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SessionApiService } from '../auth/session-api.service';
import { DataExportApiService, DataExportData } from './data-export-api.service';
import { DataExportPanelComponent } from './data-export-panel.component';

describe('DataExportPanelComponent', () => {
  let fixture: ComponentFixture<DataExportPanelComponent>;
  const completed: DataExportData = {
    id: '11111111-1111-4111-8111-111111111111',
    dataset: 'SALES',
    format: 'XLSX',
    status: 'COMPLETED',
    rowCount: 3,
    excludedColumns: [],
    errorCode: null,
    expiresAt: '2026-08-28T12:00:00.000Z',
    createdAt: '2026-08-27T12:00:00.000Z',
    completedAt: '2026-08-27T12:00:01.000Z',
    downloadReady: true,
  };
  const api = {
    create: vi.fn(),
    get: vi.fn(),
    retry: vi.fn(),
    download: vi.fn(),
  };
  const sessions = {
    session: signal({
      user: {
        id: 'user',
        email: 'admin@example.com',
        roles: ['ADMIN'],
        permissions: ['AUDIT_EXPORT', 'TENANT_MANAGE'],
      },
      tenant: { id: 'tenant', name: 'Tienda' },
      context: { branch: null, warehouse: null, cashRegister: null },
      nextStep: 'APPLICATION' as const,
    }),
  };

  beforeEach(async () => {
    api.create.mockReturnValue(of({ data: completed, meta: { apiVersion: '1' } }));
    await TestBed.configureTestingModule({
      imports: [DataExportPanelComponent],
      providers: [
        { provide: DataExportApiService, useValue: api },
        { provide: SessionApiService, useValue: sessions },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DataExportPanelComponent);
    fixture.detectChanges();
  });

  it('requests a filtered sensitive Excel export and exposes its result', () => {
    const component = fixture.componentInstance as unknown as {
      form: {
        patchValue(value: Record<string, unknown>): void;
      };
    };
    component.form.patchValue({
      dataset: 'SALES',
      format: 'XLSX',
      q: 'folio-1',
      saleStatus: 'COMPLETED',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-27',
      includeSensitive: true,
    });
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    fixture.detectChanges();

    expect(api.create).toHaveBeenCalledWith({
      dataset: 'SALES',
      format: 'XLSX',
      q: 'folio-1',
      saleStatus: 'COMPLETED',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-27',
      includeSensitive: true,
    });
    expect(fixture.nativeElement.textContent).toContain('COMPLETED');
    expect(fixture.nativeElement.textContent).toContain('3 fila(s)');
    expect(fixture.nativeElement.textContent).toContain('Descargar archivo');
  });

  it('does not offer sensitive data to a user without tenant permission', () => {
    sessions.session.update((current) => ({
      ...current,
      user: { ...current.user, permissions: ['AUDIT_EXPORT'] },
    }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input[type="checkbox"]')).toBeNull();
  });
});
