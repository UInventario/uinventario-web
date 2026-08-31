import { expect, test } from '@playwright/test';
import { mockPos } from './pos.fixtures';

interface DesktopTestWindow extends Window {
  __desktopCalls: Array<{ method: string; payload?: unknown }>;
  __emitDesktopScan: (code: string) => void;
  uinventarioDesktop: unknown;
}

test('uses the typed Desktop bridge and preserves a completed sale on drawer failure', async ({
  page,
}, testInfo) => {
  const drawerRequests: Array<Record<string, unknown>> = [];
  await page.addInitScript(() => {
    const target = window as unknown as DesktopTestWindow;
    let scanHandler: (code: string) => void = () => undefined;
    target.__desktopCalls = [];
    target.__emitDesktopScan = (code) => scanHandler(code);
    target.uinventarioDesktop = Object.freeze({
      version: 1,
      getPeripheralConfig: async () => ({
        status: 'COMPLETED',
        config: {
          scannerAdapter: 'HID_KEYBOARD',
          printerAdapter: 'SIMULATOR',
          printerName: null,
          drawerAdapter: 'SIMULATOR',
          displayAdapter: 'WINDOW',
          simulateDisconnected: false,
        },
      }),
      savePeripheralConfig: async (_context: unknown, config: unknown) => ({
        status: 'COMPLETED',
        config,
      }),
      listPrinters: async () => ({ status: 'COMPLETED', printers: [] }),
      diagnose: async (_context: unknown, capability: string, sample?: string) => {
        target.__desktopCalls.push({ method: `diagnose:${capability}`, payload: sample });
        return { status: 'COMPLETED', adapter: 'SIMULATOR' };
      },
      printReceipt: async () => ({ status: 'COMPLETED', adapter: 'SIMULATOR' }),
      openDrawer: async (_context: unknown, operationId: string) => {
        target.__desktopCalls.push({ method: 'openDrawer', payload: operationId });
        return { status: 'FAILED', adapter: 'SIMULATOR', errorCode: 'DEVICE_DISCONNECTED' };
      },
      updateDisplay: async (_context: unknown, display: unknown) => {
        target.__desktopCalls.push({ method: 'updateDisplay', payload: display });
        return { status: 'COMPLETED', adapter: 'WINDOW' };
      },
      onScan: (handler: (code: string) => void) => {
        scanHandler = handler;
        return () => {
          scanHandler = () => undefined;
        };
      },
    });
  });
  await mockPos(page, {
    permissions: ['SALES_MANAGE', 'SALE_REPRINT', 'CASH_DRAWER_OPEN', 'TENANT_MANAGE'],
    drawerRequests,
  });
  await page.goto('./ventas/pos');

  await expect(page.getByRole('button', { name: 'Desktop' })).toBeVisible();
  await page.evaluate(() =>
    (window as unknown as DesktopTestWindow).__emitDesktopScan('750100000001'),
  );
  await expect(page.getByText('Café molido', { exact: true }).last()).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as DesktopTestWindow).__desktopCalls.filter(
          ({ method }) => method === 'updateDisplay',
        ),
      ),
    )
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          payload: expect.objectContaining({ total: '30.00' }),
        }),
      ]),
    );

  await page.getByRole('button', { name: 'Desktop' }).click();
  const devices = page.getByRole('dialog', { name: 'Periféricos de esta caja' });
  await page.screenshot({ path: testInfo.outputPath('desktop-peripherals.png') });
  await devices.getByRole('button', { name: 'Pantalla' }).click();
  await expect(devices.getByText('Diagnóstico display completado.')).toBeVisible();
  await devices.getByRole('button', { name: 'Cerrar', exact: true }).click();

  await page.getByRole('button', { name: /Continuar al cobro/ }).click();
  const checkout = page.getByRole('dialog', { name: 'Completar venta' });
  await checkout.getByLabel('Efectivo recibido').fill('30');
  await checkout.getByRole('button', { name: 'Cobrar y completar venta' }).click();

  await expect(page.getByRole('dialog', { name: 'V-000001' })).toBeVisible();
  await expect(page.getByText(/venta quedó registrada, pero el cajón no respondió/i)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('drawer-failure-safe-sale.png') });
  expect(drawerRequests).toEqual([{ trigger: 'CASH_SALE_COMPLETED', saleId: 'sale-desktop-1' }]);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as DesktopTestWindow).__desktopCalls.some(
          ({ method }) => method === 'openDrawer',
        ),
      ),
    )
    .toBe(true);
});
