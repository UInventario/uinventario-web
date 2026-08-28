import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ProductApiService, ProductData } from './product-api.service';
import { ProductCodeScannerComponent } from './product-code-scanner.component';

describe('ProductCodeScannerComponent', () => {
  let fixture: ComponentFixture<ProductCodeScannerComponent>;
  const product: ProductData = {
    id: 'product-1',
    name: 'Producto',
    sku: 'SCAN-1',
    barcode: '7500000000001',
    category: null,
    brand: null,
    cost: '1.00',
    price: '2.00',
    active: true,
    version: 1,
  };
  const api = { resolveCode: vi.fn() };
  const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
  const originalDetector = Object.getOwnPropertyDescriptor(window, 'BarcodeDetector');
  const originalPlay = HTMLMediaElement.prototype.play;

  beforeEach(async () => {
    api.resolveCode.mockReset().mockReturnValue(of({ data: product }));
    await TestBed.configureTestingModule({
      imports: [ProductCodeScannerComponent],
      providers: [{ provide: ProductApiService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(ProductCodeScannerComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    if (originalMediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', originalMediaDevices);
    } else {
      Reflect.deleteProperty(navigator, 'mediaDevices');
    }
    if (originalDetector) Object.defineProperty(window, 'BarcodeDetector', originalDetector);
    else Reflect.deleteProperty(window, 'BarcodeDetector');
    HTMLMediaElement.prototype.play = originalPlay;
  });

  it('accepts manual entry and a keyboard-wedge reader without configuration', () => {
    const resolved = vi.fn();
    fixture.componentInstance.resolved.subscribe(resolved);
    const component = fixture.componentInstance as unknown as {
      code: string;
      submit(): void;
      keyboardScan(event: KeyboardEvent): void;
    };
    component.code = ' MANUAL-1 ';
    component.submit();
    expect(api.resolveCode).toHaveBeenCalledWith('MANUAL-1');

    for (const key of ['7', '5', '0', '1']) {
      component.keyboardScan(new KeyboardEvent('keydown', { key, bubbles: true }));
    }
    component.keyboardScan(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(api.resolveCode).toHaveBeenLastCalledWith('7501');
    expect(resolved).toHaveBeenCalledTimes(2);
  });

  it('requests camera permission only on demand and resolves a simulated QR code', async () => {
    const stop = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
    Object.defineProperty(window, 'BarcodeDetector', {
      configurable: true,
      value: class {
        detect() {
          return Promise.resolve([{ rawValue: 'QR-CODE-1' }]);
        }
      },
    });
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    const resolved = vi.fn();
    fixture.componentInstance.resolved.subscribe(resolved);
    expect(getUserMedia).not.toHaveBeenCalled();

    await (fixture.componentInstance as unknown as { startCamera(): Promise<void> }).startCamera();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
    expect(api.resolveCode).toHaveBeenCalledWith('QR-CODE-1');
    expect(resolved).toHaveBeenCalledWith(product);
    expect(stop).toHaveBeenCalled();
  });
});
