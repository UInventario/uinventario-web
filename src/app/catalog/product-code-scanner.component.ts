import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ProductApiService, ProductData } from './product-api.service';

interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

@Component({
  selector: 'app-product-code-scanner',
  imports: [FormsModule],
  templateUrl: './product-code-scanner.component.html',
  styleUrl: './product-code-scanner.component.scss',
})
export class ProductCodeScannerComponent implements OnDestroy {
  private readonly api = inject(ProductApiService);
  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('camera');
  readonly globalCapture = input(true);
  readonly resolved = output<ProductData>();

  protected code = '';
  protected readonly resolving = signal(false);
  protected readonly cameraActive = signal(false);
  protected readonly error = signal<string | null>(null);
  private keyboardBuffer = '';
  private lastKeyboardAt = 0;
  private stream: MediaStream | null = null;
  private animationFrame: number | null = null;
  private detector: BarcodeDetectorLike | null = null;

  ngOnDestroy(): void {
    this.stopCamera();
  }

  @HostListener('document:keydown', ['$event'])
  protected keyboardScan(event: KeyboardEvent): void {
    if (!this.globalCapture() || event.ctrlKey || event.altKey || event.metaKey) return;
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    const now = Date.now();
    if (now - this.lastKeyboardAt > 100) this.keyboardBuffer = '';
    this.lastKeyboardAt = now;
    if (event.key === 'Enter') {
      const value = this.keyboardBuffer;
      this.keyboardBuffer = '';
      if (value.length >= 3) {
        event.preventDefault();
        this.resolve(value);
      }
      return;
    }
    if (event.key.length === 1) this.keyboardBuffer += event.key;
  }

  protected submit(): void {
    this.resolve(this.code);
  }

  protected async startCamera(): Promise<void> {
    if (this.cameraActive()) return;
    this.error.set(null);
    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor })
      .BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      this.error.set(
        'La cámara no es compatible en este navegador. Usa el lector o escribe el código.',
      );
      return;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      this.detector = new Detector({
        formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'upc_a', 'upc_e'],
      });
      const video = this.video()?.nativeElement;
      if (!video) throw new Error('CAMERA_ELEMENT_NOT_AVAILABLE');
      video.srcObject = this.stream;
      await video.play();
      this.cameraActive.set(true);
      this.scanFrame();
    } catch {
      this.stopCamera();
      this.error.set(
        'No fue posible usar la cámara. Autoriza el permiso o captura el código manualmente.',
      );
    }
  }

  protected stopCamera(): void {
    if (this.animationFrame !== null) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    this.detector = null;
    this.cameraActive.set(false);
  }

  private resolve(value: string): void {
    const code = value.trim();
    if (!code || this.resolving()) return;
    this.code = code;
    this.resolving.set(true);
    this.error.set(null);
    this.api
      .resolveCode(code)
      .pipe(finalize(() => this.resolving.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.code = '';
          this.resolved.emit(data);
        },
        error: (error: HttpErrorResponse) =>
          this.error.set(
            typeof error.error?.message === 'string'
              ? error.error.message
              : 'No fue posible resolver el código. Puedes buscarlo manualmente.',
          ),
      });
  }

  private scanFrame(): void {
    const video = this.video()?.nativeElement;
    if (!this.cameraActive() || !video || !this.detector) return;
    void this.detector
      .detect(video)
      .then((codes) => {
        const value = codes.find(({ rawValue }) => rawValue.trim())?.rawValue;
        if (value) {
          this.stopCamera();
          this.resolve(value);
          return;
        }
        this.animationFrame = requestAnimationFrame(() => this.scanFrame());
      })
      .catch(() => {
        this.animationFrame = requestAnimationFrame(() => this.scanFrame());
      });
  }
}
