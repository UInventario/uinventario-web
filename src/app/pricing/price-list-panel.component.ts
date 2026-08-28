import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, finalize } from 'rxjs';
import { ProductApiService, ProductData } from '../catalog/product-api.service';
import { CustomerApiService, CustomerData } from '../customers/customer-api.service';
import {
  OrganizationApiService,
  OrganizationBranchData,
} from '../organization/organization-api.service';
import { PriceListApiService, PriceListData, PriceListInput } from './price-list-api.service';

const POSITIVE_MONEY = /^(?:[1-9]\d{0,11}(?:\.\d{1,2})?|0\.(?:0[1-9]|[1-9]\d?))$/;

@Component({
  selector: 'app-price-list-panel',
  imports: [ReactiveFormsModule],
  templateUrl: './price-list-panel.component.html',
  styleUrl: './price-list-panel.component.scss',
})
export class PriceListPanelComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(PriceListApiService);
  private readonly productsApi = inject(ProductApiService);
  private readonly customersApi = inject(CustomerApiService);
  private readonly organizationApi = inject(OrganizationApiService);

  protected readonly lists = signal<PriceListData[]>([]);
  protected readonly products = signal<ProductData[]>([]);
  protected readonly customers = signal<CustomerData[]>([]);
  protected readonly branches = signal<OrganizationBranchData[]>([]);
  protected readonly editing = signal<PriceListData | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    currency: ['MXN', [Validators.required, Validators.pattern(/^[A-Za-z]{3}$/)]],
    branchId: [''],
    customerId: [''],
    channel: ['POS'],
    priority: [0, [Validators.required, Validators.min(-100000), Validators.max(100000)]],
    validFrom: [this.localDateTime(new Date()), Validators.required],
    validTo: [''],
    active: [true],
    items: this.fb.array([this.itemGroup()]),
  });

  protected get items(): FormArray<ReturnType<PriceListPanelComponent['itemGroup']>> {
    return this.form.controls.items;
  }

  ngOnInit(): void {
    this.load();
    forkJoin({
      products: this.productsApi.list({ status: 'ACTIVE', page: 1, pageSize: 100 }),
      customers: this.customersApi.list({ status: 'ACTIVE', page: 1, pageSize: 100 }),
      branches: this.organizationApi.list(),
    }).subscribe({
      next: ({ products, customers, branches }) => {
        this.products.set(products.data);
        this.customers.set(customers.data);
        this.branches.set(branches.data.filter((branch) => branch.active));
      },
      error: () => this.error.set('No fue posible cargar las opciones de alcance.'),
    });
  }

  protected addItem(): void {
    if (this.items.length < 500) this.items.push(this.itemGroup());
  }

  protected removeItem(index: number): void {
    if (this.items.length > 1) this.items.removeAt(index);
  }

  protected edit(list: PriceListData): void {
    this.editing.set(list);
    this.form.patchValue({
      name: list.name,
      currency: list.currency,
      branchId: list.scope.branch?.id ?? '',
      customerId: list.scope.customer?.id ?? '',
      channel: list.scope.channel ?? '',
      priority: list.priority,
      validFrom: this.localDateTime(new Date(list.validFrom)),
      validTo: list.validTo ? this.localDateTime(new Date(list.validTo)) : '',
      active: list.active,
    });
    this.items.clear();
    for (const item of list.items) this.items.push(this.itemGroup(item.product.id, item.price));
    this.error.set(null);
    this.success.set(null);
  }

  protected cancel(): void {
    this.editing.set(null);
    this.reset();
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    if (new Set(raw.items.map((item) => item.productId)).size !== raw.items.length) {
      this.error.set('Cada producto puede aparecer una sola vez en la lista.');
      return;
    }
    if (raw.validTo && new Date(raw.validTo) <= new Date(raw.validFrom)) {
      this.error.set('El fin de vigencia debe ser posterior al inicio.');
      return;
    }
    const input: PriceListInput = {
      name: raw.name.trim(),
      currency: raw.currency.trim().toUpperCase(),
      ...(raw.branchId ? { branchId: raw.branchId } : {}),
      ...(raw.customerId ? { customerId: raw.customerId } : {}),
      ...(raw.channel ? { channel: raw.channel as PriceListInput['channel'] } : {}),
      priority: Number(raw.priority),
      validFrom: new Date(raw.validFrom).toISOString(),
      ...(raw.validTo ? { validTo: new Date(raw.validTo).toISOString() } : {}),
      active: raw.active,
      items: raw.items.map((item) => ({ productId: item.productId, price: item.price.trim() })),
    };
    const current = this.editing();
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    const operation = current
      ? this.api.update(current.id, { ...input, version: current.version })
      : this.api.create(input);
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.success.set(current ? 'Lista de precios actualizada.' : 'Lista de precios creada.');
        this.editing.set(null);
        this.reset();
        this.load();
      },
      error: (error: HttpErrorResponse) => {
        const code = (error.error as { code?: string } | null)?.code;
        this.error.set(
          code === 'PRICE_LIST_VERSION_CONFLICT'
            ? 'La lista cambio; recarga antes de guardar.'
            : 'No fue posible guardar la lista de precios.',
        );
        if (code === 'PRICE_LIST_VERSION_CONFLICT') this.load();
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.api
      .list()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ data }) => this.lists.set(data),
        error: () => this.error.set('No fue posible cargar las listas de precios.'),
      });
  }

  private reset(): void {
    this.form.reset({
      name: '',
      currency: 'MXN',
      branchId: '',
      customerId: '',
      channel: 'POS',
      priority: 0,
      validFrom: this.localDateTime(new Date()),
      validTo: '',
      active: true,
      items: [],
    });
    this.items.clear();
    this.items.push(this.itemGroup());
  }

  private itemGroup(productId = '', price = '') {
    return this.fb.nonNullable.group({
      productId: [productId, Validators.required],
      price: [price, [Validators.required, Validators.pattern(POSITIVE_MONEY)]],
    });
  }

  private localDateTime(date: Date): string {
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }
}
