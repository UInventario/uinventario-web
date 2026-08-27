import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ProductApiService, ProductData, ProductInput } from '../catalog/product-api.service';
import { SessionApiService } from './session-api.service';

const MONEY_PATTERN = /^(0|[1-9]\d{0,11})(\.\d{1,2})?$/;
const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;
const BARCODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{3,63}$/;

@Component({
  selector: 'app-application-page',
  imports: [ReactiveFormsModule],
  templateUrl: './application.page.html',
  styleUrl: './application.page.scss',
})
export class ApplicationPage implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly products = inject(ProductApiService);
  private readonly sessions = inject(SessionApiService);

  protected readonly session = this.sessions.session;
  protected readonly categories = signal<Array<{ id: string; name: string }>>([]);
  protected readonly brands = signal<Array<{ id: string; name: string }>>([]);
  protected readonly createdProduct = signal<ProductData | null>(null);
  protected readonly loadingOptions = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(160)]],
    sku: ['', [Validators.required, Validators.pattern(SKU_PATTERN)]],
    barcode: ['', [Validators.pattern(BARCODE_PATTERN)]],
    categoryName: ['', [Validators.minLength(2), Validators.maxLength(80)]],
    brandName: ['', [Validators.minLength(2), Validators.maxLength(120)]],
    cost: ['', [Validators.required, Validators.pattern(MONEY_PATTERN)]],
    price: ['', [Validators.required, Validators.pattern(MONEY_PATTERN)]],
  });

  ngOnInit(): void {
    this.loadOptions();
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.errorMessage.set(null);
    this.products
      .create(this.toInput())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.createdProduct.set(data);
          this.form.reset({
            name: '',
            sku: '',
            barcode: '',
            categoryName: data.category?.name ?? '',
            brandName: data.brand?.name ?? '',
            cost: '',
            price: '',
          });
          this.loadOptions();
        },
        error: (error: HttpErrorResponse) => this.errorMessage.set(this.messageFor(error)),
      });
  }

  protected logout(): void {
    this.sessions.logout().subscribe({ error: () => undefined });
  }

  private loadOptions(): void {
    this.loadingOptions.set(true);
    this.products
      .getOptions()
      .pipe(finalize(() => this.loadingOptions.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.categories.set(data.categories);
          this.brands.set(data.brands);
        },
        error: () => this.errorMessage.set('No fue posible cargar categorías y marcas.'),
      });
  }

  private toInput(): ProductInput {
    const value = this.form.getRawValue();
    return {
      name: value.name.trim(),
      sku: value.sku.trim(),
      ...(value.barcode.trim() ? { barcode: value.barcode.trim() } : {}),
      ...(value.categoryName.trim() ? { categoryName: value.categoryName.trim() } : {}),
      ...(value.brandName.trim() ? { brandName: value.brandName.trim() } : {}),
      cost: value.cost.trim(),
      price: value.price.trim(),
    };
  }

  private messageFor(error: HttpErrorResponse): string {
    const code = (error.error as { code?: string } | null)?.code;
    if (code === 'SKU_ALREADY_EXISTS') return 'Ya existe un producto con ese SKU.';
    if (code === 'BARCODE_ALREADY_EXISTS') {
      return 'Ya existe un producto con ese código de barras.';
    }
    if (error.status === 0) return 'No pudimos conectar con el servicio. Intenta nuevamente.';
    return 'No fue posible crear el producto con esos datos.';
  }
}
