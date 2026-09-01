import { expect, test } from '@playwright/test';
import { mockPos, trackedProduct } from './pos.fixtures';

test('requires lot and serial selection before quoting a tracked product', async ({ page }) => {
  const requests: Array<Record<string, unknown>> = [];
  await mockPos(page, {
    permissions: ['SALES_MANAGE', 'INVENTORY_VIEW'],
    quoteRequests: requests,
  });
  await page.goto('./ventas/pos');

  await page.getByRole('button', { name: 'Agregar Equipo serializado' }).click();
  const dialog = page.getByRole('dialog', { name: 'Equipo serializado' });
  await expect(dialog.getByText('Identifica las unidades')).toBeVisible();
  await dialog.getByLabel('Lote a descontar').selectOption('lot-1');
  await dialog.getByRole('checkbox', { name: /SN-0001/ }).check();
  await dialog.getByRole('button', { name: 'Aplicar cambios' }).click();

  await expect(page.getByText('Lote identificado')).toBeVisible();
  await expect(page.getByText('SN-0001')).toBeVisible();
  await expect
    .poll(() => (requests.at(-1)?.['lines'] as Array<Record<string, unknown>> | undefined)?.[0])
    .toMatchObject({
      productId: trackedProduct.id,
      quantity: '1.000',
      lotId: 'lot-1',
      serialNumbers: ['SN-0001'],
    });
});

test('restores carts only inside the original operational context', async ({ page }) => {
  const register = { current: 'register-1' };
  await mockPos(page, { register });
  await page.goto('./ventas/pos');
  await page.getByRole('button', { name: 'Agregar Café molido' }).click();
  await expect(page.getByText('Café molido', { exact: true }).last()).toBeVisible();

  register.current = 'register-2';
  await page.reload();
  await expect(page.getByText('La venta está vacía')).toBeVisible();

  register.current = 'register-1';
  await page.reload();
  await expect(page.getByText('Café molido', { exact: true }).last()).toBeVisible();
});

test('adds the detected camera code without replacing the existing cart', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: async () => new MediaStream() },
    });
    Object.defineProperty(globalThis, 'BarcodeDetector', {
      configurable: true,
      value: class {
        async detect() {
          return [{ rawValue: '750100000001' }];
        }
      },
    });
    HTMLMediaElement.prototype.play = async () => undefined;
  });
  await mockPos(page);
  await page.goto('./ventas/pos');
  await page.getByRole('button', { name: 'Agregar Instalación básica' }).click();
  await page.getByRole('button', { name: 'Escanear con cámara' }).click();

  await expect(page.getByText('Café molido', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('Instalación básica', { exact: true }).last()).toBeVisible();
});
