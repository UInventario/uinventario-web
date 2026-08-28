import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { SessionApiService, SessionData } from '../auth/session-api.service';
import { InventoryApiService } from './inventory-api.service';
import { InventoryValuationPolicyPanelComponent } from './inventory-valuation-policy-panel.component';

describe('InventoryValuationPolicyPanelComponent', () => {
  let fixture: ComponentFixture<InventoryValuationPolicyPanelComponent>;
  let inventory: {
    getValuationPolicy: ReturnType<typeof vi.fn>;
    previewValuationPolicy: ReturnType<typeof vi.fn>;
    changeValuationPolicy: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    const session = signal<SessionData | null>({
      user: {
        id: 'admin-1',
        email: 'admin@example.com',
        roles: ['ADMIN'],
        permissions: ['INVENTORY_VIEW', 'INVENTORY_VALUATION_MANAGE'],
      },
      tenant: { id: 'tenant-1', name: 'Tienda' },
      context: {
        branch: { id: 'branch-1', name: 'Sucursal' },
        warehouse: { id: 'warehouse-1', name: 'Bodega' },
        cashRegister: null,
      },
      nextStep: 'APPLICATION',
    });
    inventory = {
      getValuationPolicy: vi.fn().mockReturnValue(
        of({
          data: {
            method: 'MOVING_AVERAGE' as const,
            version: 1,
            effectiveAt: '2026-08-28T00:00:00.000Z',
            migrationRule: 'INITIAL_DEFAULT' as const,
          },
          meta: { apiVersion: '1' as const },
        }),
      ),
      previewValuationPolicy: vi.fn().mockReturnValue(
        of({
          data: {
            current: {
              method: 'MOVING_AVERAGE' as const,
              version: 1,
              effectiveAt: '2026-08-28T00:00:00.000Z',
              migrationRule: 'INITIAL_DEFAULT' as const,
            },
            targetMethod: 'FIFO' as const,
            allowed: true,
            blockingReasons: [],
            strategy: 'USE_MAINTAINED_FIFO_LAYERS' as const,
            productsToMigrate: 0,
            locationsToMigrate: 0,
            devicesToRebootstrap: 2,
            planFingerprint: 'plan-fingerprint',
          },
          meta: { apiVersion: '1' as const },
        }),
      ),
      changeValuationPolicy: vi.fn().mockReturnValue(
        of({
          data: {
            method: 'FIFO' as const,
            version: 2,
            effectiveAt: '2026-08-28T12:00:00.000Z',
            migrationRule: 'FORWARD_ONLY_CUTOVER' as const,
          },
          meta: { apiVersion: '1' as const, replay: false },
        }),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [InventoryValuationPolicyPanelComponent],
      providers: [
        { provide: InventoryApiService, useValue: inventory },
        { provide: SessionApiService, useValue: { session } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(InventoryValuationPolicyPanelComponent);
    fixture.detectChanges();
  });

  it('prevalidates and applies a forward-only valuation cutover', () => {
    const buttons = (): HTMLButtonElement[] => [
      ...fixture.nativeElement.querySelectorAll('button'),
    ];

    buttons()
      .find(({ textContent }) => textContent?.includes('Prevalidar'))
      ?.click();
    fixture.detectChanges();

    expect(inventory.previewValuationPolicy).toHaveBeenCalledWith('FIFO');
    expect(fixture.nativeElement.textContent).toContain('Dispositivos a resincronizar');
    buttons()
      .find(({ textContent }) => textContent?.includes('Confirmar'))
      ?.click();
    fixture.detectChanges();

    expect(inventory.changeValuationPolicy).toHaveBeenCalledWith(
      {
        targetMethod: 'FIFO',
        expectedVersion: 1,
        planFingerprint: 'plan-fingerprint',
      },
      expect.stringMatching(/^web-valuation-cutover-/),
    );
    expect(fixture.nativeElement.textContent).toContain('Activo · versión 2');
    expect(fixture.nativeElement.textContent).toContain('Método actualizado');
  });
});
