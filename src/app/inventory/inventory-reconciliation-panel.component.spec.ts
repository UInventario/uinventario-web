import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SessionApiService, SessionData } from '../auth/session-api.service';
import {
  InventoryApiService,
  InventoryReconciliationRunData,
} from './inventory-api.service';
import { InventoryReconciliationPanelComponent } from './inventory-reconciliation-panel.component';

describe('InventoryReconciliationPanelComponent', () => {
  let fixture: ComponentFixture<InventoryReconciliationPanelComponent>;
  let inventory: {
    latestReconciliation: ReturnType<typeof vi.fn>;
    runReconciliation: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    const session = signal<SessionData | null>({
      user: {
        id: 'admin-1',
        email: 'admin@example.com',
        roles: ['ADMIN'],
        permissions: ['INVENTORY_VIEW', 'INVENTORY_ADJUST'],
      },
      tenant: { id: 'tenant-1', name: 'Tienda' },
      context: {
        branch: { id: 'branch-1', name: 'Sucursal' },
        warehouse: { id: 'warehouse-1', name: 'Bodega' },
        cashRegister: null,
      },
      nextStep: 'APPLICATION',
    });
    const critical: InventoryReconciliationRunData = {
      id: 'run-1',
      status: 'COMPLETED',
      overallStatus: 'CRITICAL',
      summary: { findings: 1, warnings: 0, critical: 1 },
      policy: { releaseBlocked: true, operationsBlocked: true },
      correlationId: 'correlation-1',
      responsible: { id: 'admin-1', email: 'admin@example.com' },
      startedAt: '2026-08-28T00:00:00.000Z',
      finishedAt: '2026-08-28T00:00:01.000Z',
      findings: [
        {
          id: 'finding-1',
          code: 'SERIAL_STATE_MISMATCH',
          severity: 'CRITICAL',
          scopeType: 'SERIAL',
          product: { id: 'product-1', name: 'Terminal', sku: 'SER-1' },
          location: { id: 'location-1', name: 'General', code: 'GEN' },
          subjectReference: 'AVAILABLE',
          expectedValue: '2.0000',
          actualValue: '1.0000',
          differenceValue: '-1.0000',
          message: 'Las series disponibles no coinciden con el saldo.',
          recommendedAction: 'Revisar el estado y la ubicación de cada serie.',
          blocksOperations: true,
        },
      ],
    };
    inventory = {
      latestReconciliation: vi.fn().mockReturnValue(
        of({ data: null, meta: { apiVersion: '1' as const } }),
      ),
      runReconciliation: vi.fn().mockReturnValue(
        of({
          data: critical,
          meta: { apiVersion: '1' as const, idempotentReplay: false },
        }),
      ),
    };
    await TestBed.configureTestingModule({
      imports: [InventoryReconciliationPanelComponent],
      providers: [
        { provide: InventoryApiService, useValue: inventory },
        { provide: SessionApiService, useValue: { session } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(InventoryReconciliationPanelComponent);
    fixture.detectChanges();
  });

  it('runs reconciliation and explains critical blocking findings', () => {
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    expect(inventory.runReconciliation).toHaveBeenCalledWith(
      expect.stringMatching(/^web-inventory-reconciliation-/),
    );
    expect(fixture.nativeElement.textContent).toContain('Crítico');
    expect(fixture.nativeElement.textContent).toContain(
      'operaciones de inventario están bloqueadas',
    );
    expect(fixture.nativeElement.textContent).toContain('SERIAL_STATE_MISMATCH');
    expect(fixture.nativeElement.textContent).toContain(
      'esperado 2.0000 · actual 1.0000',
    );
  });
});
