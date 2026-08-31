import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { DesktopPeripheralContext } from './desktop-peripheral.models';
import { WebDesktopPeripheralAdapter } from './web-desktop-peripheral.adapter';

const context: DesktopPeripheralContext = {
  tenantId: 'tenant-1',
  cashRegisterId: 'register-1',
  deviceId: 'device-1',
};

describe('WebDesktopPeripheralAdapter', () => {
  it('detects and delegates the versioned bridge without exposing Electron', async () => {
    const scan = signal('');
    const bridge = {
      version: 1 as const,
      getPeripheralConfig: vi.fn().mockResolvedValue({ status: 'COMPLETED' }),
      savePeripheralConfig: vi.fn().mockResolvedValue({ status: 'COMPLETED' }),
      listPrinters: vi.fn().mockResolvedValue({ status: 'COMPLETED', printers: [] }),
      diagnose: vi.fn().mockResolvedValue({ status: 'COMPLETED' }),
      printReceipt: vi.fn().mockResolvedValue({ status: 'COMPLETED' }),
      openDrawer: vi.fn().mockResolvedValue({ status: 'COMPLETED' }),
      updateDisplay: vi.fn().mockResolvedValue({ status: 'COMPLETED' }),
      onScan: vi.fn((handler: (code: string) => void) => {
        handler('CODE-1');
        return () => scan.set('removed');
      }),
    };
    Object.defineProperty(window, 'uinventarioDesktop', {
      configurable: true,
      value: bridge,
    });

    const adapter = new WebDesktopPeripheralAdapter();
    expect(adapter.available()).toBe(true);
    await adapter.getConfig(context);
    const remove = adapter.onScan((code) => scan.set(code));
    expect(scan()).toBe('CODE-1');
    remove();
    expect(scan()).toBe('removed');
    expect(bridge.getPeripheralConfig).toHaveBeenCalledWith(context);
    delete (window as Window & { uinventarioDesktop?: unknown }).uinventarioDesktop;
  });

  it('provides a safe browser fallback and emits the session cleanup contract', () => {
    delete (window as Window & { uinventarioDesktop?: unknown }).uinventarioDesktop;
    const adapter = new WebDesktopPeripheralAdapter();
    const closed = vi.fn();
    window.addEventListener('uinventario:session-closed', closed, { once: true });

    expect(adapter.available()).toBe(false);
    expect(adapter.onScan(() => undefined)).toBeTypeOf('function');
    expect(() => adapter.getConfig(context)).toThrow('DESKTOP_BRIDGE_UNAVAILABLE');
    adapter.notifySessionClosed();
    expect(closed).toHaveBeenCalledOnce();
  });
});
