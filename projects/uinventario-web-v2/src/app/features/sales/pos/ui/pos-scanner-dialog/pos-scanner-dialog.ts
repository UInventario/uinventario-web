import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';

interface DetectedBarcode {
  readonly rawValue: string;
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<readonly DetectedBarcode[]>;
}

interface BarcodeDetectorConstructor {
  new (options: { formats: readonly string[] }): BarcodeDetectorLike;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'ui-pos-scanner-dialog',
  styleUrl: './pos-scanner-dialog.scss',
  templateUrl: './pos-scanner-dialog.html',
})
export class PosScannerDialog implements AfterViewInit, OnDestroy {
  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('camera');
  private stream?: MediaStream;
  private scanTimer?: ReturnType<typeof setTimeout>;
  private stopped = false;

  readonly closed = output<void>();
  readonly codeDetected = output<string>();
  protected readonly status = signal('Preparando cámara…');
  protected readonly failed = signal(false);

  async ngAfterViewInit(): Promise<void> {
    const Detector = (
      globalThis as typeof globalThis & { BarcodeDetector?: BarcodeDetectorConstructor }
    ).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      this.fail(
        'Este navegador no admite lectura por cámara. Usa el lector USB o escribe el código.',
      );
      return;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      const element = this.video().nativeElement;
      element.srcObject = this.stream;
      await element.play();
      this.status.set('Apunta la cámara al código de barras o QR.');
      this.detect(new Detector({ formats: ['ean_13', 'ean_8', 'code_128', 'qr_code'] }));
    } catch {
      this.fail('No fue posible abrir la cámara. Revisa el permiso del navegador.');
    }
  }

  ngOnDestroy(): void {
    this.stop();
  }

  protected close(): void {
    this.stop();
    this.closed.emit();
  }

  private detect(detector: BarcodeDetectorLike): void {
    if (this.stopped) return;
    detector
      .detect(this.video().nativeElement)
      .then((codes) => {
        const value = codes[0]?.rawValue.trim();
        if (!value || this.stopped) {
          this.schedule(detector);
          return;
        }
        this.stop();
        this.codeDetected.emit(value);
      })
      .catch(() => this.schedule(detector));
  }

  private schedule(detector: BarcodeDetectorLike): void {
    if (!this.stopped) this.scanTimer = setTimeout(() => this.detect(detector), 180);
  }

  private fail(message: string): void {
    this.failed.set(true);
    this.status.set(message);
  }

  private stop(): void {
    this.stopped = true;
    if (this.scanTimer) clearTimeout(this.scanTimer);
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
  }
}
