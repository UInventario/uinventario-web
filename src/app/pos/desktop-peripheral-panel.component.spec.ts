import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { DesktopPeripheralPanelComponent } from './desktop-peripheral-panel.component';
import { DesktopPeripheralService } from './desktop-peripheral.service';
import { PosApiService } from './pos-api.service';

describe('DesktopPeripheralPanelComponent', () => {
  let fixture: ComponentFixture<DesktopPeripheralPanelComponent>;
  const context = {
    tenantId: 'tenant-1',
    cashRegisterId: 'register-1',
    deviceId: 'DEVICE-1',
  };
  const config = {
    scannerAdapter: 'HID_KEYBOARD' as const,
    printerAdapter: 'SIMULATOR' as const,
    printerName: null,
    drawerAdapter: 'SIMULATOR' as const,
    displayAdapter: 'SIMULATOR' as const,
    simulateDisconnected: false,
  };
  const desktop = {
    available: signal(true),
    getConfig: vi.fn().mockResolvedValue({ status: 'COMPLETED', config }),
    listPrinters: vi.fn().mockResolvedValue({ status: 'COMPLETED', printers: [] }),
    saveConfig: vi.fn().mockResolvedValue({ status: 'COMPLETED', config }),
    diagnose: vi.fn().mockResolvedValue({ status: 'COMPLETED', adapter: 'HID_KEYBOARD' }),
    updateDisplay: vi.fn().mockResolvedValue({ status: 'COMPLETED', adapter: 'SIMULATOR' }),
  };
  const pos = {
    getPeripheralProfile: vi.fn().mockReturnValue(
      of({
        data: {
          cashRegister: { id: 'register-1', name: 'Caja 1', code: 'MAIN' },
          deviceId: 'DEVICE-1',
        },
      }),
    ),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    desktop.getConfig.mockResolvedValue({ status: 'COMPLETED', config });
    desktop.listPrinters.mockResolvedValue({ status: 'COMPLETED', printers: [] });
    desktop.diagnose.mockResolvedValue({ status: 'COMPLETED', adapter: 'HID_KEYBOARD' });
    await TestBed.configureTestingModule({
      imports: [DesktopPeripheralPanelComponent],
      providers: [
        { provide: DesktopPeripheralService, useValue: desktop },
        { provide: PosApiService, useValue: pos },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DesktopPeripheralPanelComponent);
    fixture.componentRef.setInput('tenantId', context.tenantId);
    fixture.componentRef.setInput('cashRegisterId', context.cashRegisterId);
    fixture.componentRef.setInput('canConfigure', true);
    fixture.componentRef.setInput('canOpenDrawer', true);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('isolates the profile by tenant, cash register and device', () => {
    expect(desktop.getConfig).toHaveBeenCalledWith(context);
    expect(desktop.listPrinters).toHaveBeenCalledWith(context);
  });

  it('diagnoses a reader without creating or changing a sale', async () => {
    await (
      fixture.componentInstance as unknown as {
        diagnose(capability: 'SCANNER'): Promise<void>;
      }
    ).diagnose('SCANNER');
    fixture.detectChanges();

    expect(desktop.diagnose).toHaveBeenCalledWith(context, 'SCANNER', '7500000000001');
    expect(pos.getPeripheralProfile).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('completado');
  });
});
