import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { finalize } from 'rxjs';
import {
  FiscalContractApiService,
  FiscalContractValidation,
  FiscalCountryContract,
  FiscalDocumentType,
  FiscalTenantConfiguration,
} from './fiscal-contract-api.service';

@Component({
  selector: 'app-fiscal-contract-panel',
  imports: [DatePipe],
  templateUrl: './fiscal-contract-panel.component.html',
  styleUrl: './fiscal-contract-panel.component.scss',
})
export class FiscalContractPanelComponent implements OnInit {
  private readonly api = inject(FiscalContractApiService);

  protected readonly countryCode = signal<string | null>(null);
  protected readonly contract = signal<FiscalCountryContract | null>(null);
  protected readonly configuration = signal<FiscalTenantConfiguration | null>(null);
  protected readonly validation = signal<FiscalContractValidation | null>(null);
  protected readonly supportedCountries = signal<string[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  ngOnInit(): void {
    this.api
      .get()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ data, meta }) => {
          this.countryCode.set(data.countryCode);
          this.contract.set(data.contract);
          this.configuration.set(data.configuration);
          this.validation.set(data.validation);
          this.supportedCountries.set(meta.supportedCountries);
        },
        error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
      });
  }

  protected patch(change: Partial<FiscalTenantConfiguration>): void {
    this.configuration.update((current) => (current ? { ...current, ...change } : current));
  }

  protected toggleDocument(type: FiscalDocumentType, checked: boolean): void {
    const current = this.configuration();
    if (!current) return;
    this.patch({
      documentTypes: checked
        ? [...new Set([...current.documentTypes, type])]
        : current.documentTypes.filter((candidate) => candidate !== type),
    });
  }

  protected toggleTax(code: string, checked: boolean): void {
    const current = this.configuration();
    if (!current) return;
    this.patch({
      taxCodes: checked
        ? [...new Set([...current.taxCodes, code])]
        : current.taxCodes.filter((candidate) => candidate !== code),
    });
  }

  protected save(): void {
    const configuration = this.configuration();
    if (!configuration || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.api
      .update(configuration)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.configuration.set(data.configuration);
          this.contract.set(data.contract);
          this.validation.set(data.validation);
          this.success.set('Contrato fiscal guardado para esta empresa.');
        },
        error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
      });
  }

  protected requirementLabel(value: string): string {
    return (
      (
        {
          TAX_IDENTIFIER: 'Identificador fiscal',
          CERTIFICATE_SECRET_REFERENCE: 'Referencia del certificado',
          PRIVATE_KEY_SECRET_REFERENCE: 'Referencia de la llave privada',
          FOLIO_AUTHORIZATION_SECRET_REFERENCE: 'Referencia de autorización de folios',
          ENVIRONMENT: 'Ambiente',
        } as Record<string, string>
      )[value] ?? value
    );
  }

  private message(error: HttpErrorResponse): string {
    if (error.status === 403) return 'No tienes permiso para administrar fiscalidad.';
    if (error.status === 0) return 'No fue posible conectar con el servicio.';
    if (error.status === 400) return 'Faltan requisitos o existe una selección incompatible.';
    return 'No fue posible guardar el contrato fiscal.';
  }
}
