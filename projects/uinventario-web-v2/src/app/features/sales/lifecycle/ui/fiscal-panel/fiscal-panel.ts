import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../../core/api/api-error';
import { SalesLifecycleFacade } from '../../application/sales-lifecycle.facade';
import {
  FiscalDocumentType,
  SaleDetail,
  SaleFiscalDocument,
} from '../../domain/sales-lifecycle.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ReactiveFormsModule],
  selector: 'ui-sale-fiscal-panel',
  styleUrls: ['./fiscal-panel.scss', './fiscal-panel-responsive.scss'],
  templateUrl: './fiscal-panel.html',
})
export class FiscalPanel {
  private readonly facade = inject(SalesLifecycleFacade);
  private readonly formBuilder = inject(FormBuilder);
  private readonly actionKeys = new Map<string, string>();

  readonly sale = input.required<SaleDetail>();
  readonly document = input<SaleFiscalDocument | null>(null);
  readonly canManage = input(false);
  readonly canVoid = input(false);
  readonly documentChanged = output<SaleFiscalDocument>();
  readonly operationNotice = output<string>();
  readonly operationError = output<string>();

  protected readonly busy = signal<string | null>(null);
  protected readonly issueForm = this.formBuilder.nonNullable.group({
    documentType: ['INVOICE' as FiscalDocumentType],
    scenario: ['SUCCESS' as 'SUCCESS' | 'REJECT' | 'TIMEOUT'],
  });
  protected readonly emailForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
  });

  protected issue(): void {
    const input = this.issueForm.getRawValue();
    const keyName = `fiscal-issue:${this.sale().id}`;
    this.run(
      'issue',
      this.facade.issueFiscal(this.sale().id, input, this.keyFor(keyName)),
      (document) => {
        this.actionKeys.delete(keyName);
        this.documentChanged.emit(document);
        this.operationNotice.emit('Solicitud fiscal enviada al adaptador configurado.');
      },
    );
  }

  protected query(): void {
    this.documentAction('query', (key) => this.facade.queryFiscal(this.sale().id, key));
  }

  protected cancel(): void {
    this.documentAction('cancel', (key) => this.facade.cancelFiscal(this.sale().id, key));
  }

  protected send(): void {
    if (this.emailForm.invalid || this.busy()) return;
    const keyName = `fiscal-send:${this.sale().id}`;
    this.run(
      'send',
      this.facade.sendFiscal(
        this.sale().id,
        this.emailForm.controls.email.value.trim(),
        this.keyFor(keyName),
      ),
      (delivery) => {
        this.actionKeys.delete(keyName);
        this.operationNotice.emit(
          `Documento enviado a ${delivery.recipient} mediante ${delivery.mode === 'SIMULATED' ? 'simulador' : 'proveedor real'}.`,
        );
      },
    );
  }

  protected download(kind: 'PDF' | 'XML'): void {
    if (this.busy()) return;
    this.run(`download-${kind}`, this.facade.downloadFiscal(this.sale().id, kind), (file) => {
      const binary = atob(file.contentBase64);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const blob = new Blob([bytes], { type: file.mediaType });
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = file.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    });
  }

  protected statusLabel(status: SaleFiscalDocument['status']): string {
    return {
      PENDING: 'Pendiente',
      ACCEPTED: 'Aceptado',
      REJECTED: 'Rechazado',
      INDETERMINATE: 'Indeterminado',
      CANCELLED: 'Cancelado',
    }[status];
  }

  private documentAction(
    action: string,
    operation: (key: string) => import('rxjs').Observable<SaleFiscalDocument>,
  ): void {
    const keyName = `${action}:${this.sale().id}`;
    this.run(action, operation(this.keyFor(keyName)), (document) => {
      this.actionKeys.delete(keyName);
      this.documentChanged.emit(document);
      this.operationNotice.emit('Estado fiscal actualizado desde el adaptador.');
    });
  }

  private run<T>(
    action: string,
    operation: import('rxjs').Observable<T>,
    success: (value: T) => void,
  ): void {
    if (this.busy()) return;
    this.busy.set(action);
    operation.pipe(finalize(() => this.busy.set(null))).subscribe({
      next: success,
      error: (error: unknown) => this.operationError.emit(this.messageFor(error)),
    });
  }

  private keyFor(action: string): string {
    const existing = this.actionKeys.get(action);
    if (existing) return existing;
    const created = `web-${action}-${crypto.randomUUID()}`;
    this.actionKeys.set(action, created);
    return created;
  }

  private messageFor(error: unknown): string {
    if (!(error instanceof ApiError)) return 'No fue posible completar la operación fiscal.';
    const messages: Record<string, string> = {
      FISCAL_DOCUMENT_NOT_FOUND: 'Todavía no existe un documento fiscal para esta venta.',
      FISCAL_DOCUMENT_NOT_DELIVERABLE: 'El documento debe estar aceptado antes de enviarse.',
      IDEMPOTENCY_KEY_REUSED: 'La operación ya fue utilizada con otros datos.',
    };
    return messages[error.code] ?? error.message;
  }
}
