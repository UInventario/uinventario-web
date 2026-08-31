import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { PricingFacade } from '../../application/pricing.facade';
import {
  PriceChannel,
  PriceList,
  PriceListInput,
  PricingCustomer,
  PricingProduct,
} from '../../domain/pricing.models';

const MONEY = /^(?:[1-9]\d{0,11}(?:\.\d{1,2})?|0\.(?:0[1-9]|[1-9]\d?))$/;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  selector: 'ui-price-list-editor',
  styleUrl: './price-list-editor.scss',
  templateUrl: './price-list-editor.html',
})
export class PriceListEditor implements OnInit {
  private readonly pricing = inject(PricingFacade);
  private readonly formBuilder = inject(FormBuilder);

  readonly current = input<PriceList | null>(null);
  readonly branch = input<{ readonly id: string; readonly name: string } | null>(null);
  readonly busy = input(false);
  readonly saveError = input<string | null>(null);
  readonly closed = output<void>();
  readonly submitted = output<PriceListInput>();

  protected readonly products = signal<readonly PricingProduct[]>([]);
  protected readonly customers = signal<readonly PricingCustomer[]>([]);
  protected readonly selectedCustomer = signal<PricingCustomer | null>(null);
  protected readonly loadingProducts = signal(false);
  protected readonly searchingCustomers = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly channels: readonly { value: PriceChannel | ''; label: string }[] = [
    { value: '', label: 'Todos los canales' },
    { value: 'POS', label: 'Punto de venta' },
    { value: 'WEB', label: 'Web' },
    { value: 'MOBILE', label: 'Móvil' },
    { value: 'DESKTOP', label: 'Escritorio' },
  ];
  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    currency: ['MXN', [Validators.required, Validators.pattern(/^[A-Z]{3}$/)]],
    scope: ['GLOBAL' as 'GLOBAL' | 'BRANCH'],
    channel: ['' as PriceChannel | ''],
    priority: [0, [Validators.required, Validators.min(-100000), Validators.max(100000)]],
    validFrom: ['', Validators.required],
    validTo: [''],
    active: [true],
    productId: [''],
    productQuery: [''],
    customerQuery: [''],
    items: this.formBuilder.array([] as ReturnType<PriceListEditor['itemGroup']>[]),
  });

  protected get items(): FormArray<ReturnType<PriceListEditor['itemGroup']>> {
    return this.form.controls.items;
  }

  ngOnInit(): void {
    const current = this.current();
    this.form.patchValue({
      name: current?.name ?? '',
      currency: current?.currency ?? 'MXN',
      scope: current?.scope.branch ? 'BRANCH' : 'GLOBAL',
      channel: current?.scope.channel ?? '',
      priority: current?.priority ?? 0,
      validFrom: localDate(current?.validFrom ?? new Date().toISOString()),
      validTo: current?.validTo ? localDate(current.validTo) : '',
      active: current?.active ?? true,
    });
    if (current?.scope.customer) {
      this.selectedCustomer.set({ ...current.scope.customer, identifier: null, email: null });
    }
    current?.items.forEach((item) => this.items.push(this.itemGroup(item.product, item.price)));
    this.loadProducts('');
  }

  protected loadProducts(query = this.form.controls.productQuery.value): void {
    this.loadingProducts.set(true);
    this.pricing
      .searchProducts(query)
      .pipe(finalize(() => this.loadingProducts.set(false)))
      .subscribe({
        next: (products) => this.products.set(products),
        error: () => this.error.set('No fue posible consultar productos.'),
      });
  }

  protected addProduct(): void {
    const id = this.form.controls.productId.value;
    const product = this.products().find((candidate) => candidate.id === id);
    if (!product || this.items.controls.some((item) => item.controls.productId.value === id))
      return;
    this.items.push(this.itemGroup(product, product.price));
    this.form.controls.productId.setValue('');
  }

  protected searchCustomers(): void {
    const query = this.form.controls.customerQuery.value.trim();
    if (query.length < 2) return;
    this.searchingCustomers.set(true);
    this.pricing
      .searchCustomers(query)
      .pipe(finalize(() => this.searchingCustomers.set(false)))
      .subscribe({
        next: (customers) => this.customers.set(customers),
        error: () => this.error.set('No fue posible consultar clientes.'),
      });
  }

  protected chooseCustomer(customer: PricingCustomer): void {
    this.selectedCustomer.set(customer);
    this.customers.set([]);
    this.form.controls.customerQuery.setValue('');
  }

  protected submit(): void {
    if (this.busy()) return;
    if (this.form.invalid || !this.items.length) {
      this.form.markAllAsTouched();
      this.error.set('Completa la vigencia y agrega al menos un producto con precio válido.');
      return;
    }
    const value = this.form.getRawValue();
    if (value.validTo && Date.parse(value.validTo) <= Date.parse(value.validFrom)) {
      this.error.set('El fin de vigencia debe ser posterior al inicio.');
      return;
    }
    const branchId = value.scope === 'BRANCH' ? this.branch()?.id : undefined;
    if (value.scope === 'BRANCH' && !branchId) {
      this.error.set('Selecciona una sucursal operativa antes de guardar.');
      return;
    }
    this.submitted.emit({
      name: value.name,
      currency: value.currency,
      priority: Number(value.priority),
      active: value.active,
      validFrom: new Date(value.validFrom).toISOString(),
      ...(value.validTo ? { validTo: new Date(value.validTo).toISOString() } : {}),
      ...(branchId ? { branchId } : {}),
      ...(this.selectedCustomer() ? { customerId: this.selectedCustomer()!.id } : {}),
      ...(value.channel ? { channel: value.channel } : {}),
      items: value.items.map(({ productId, price }) => ({ productId, price })),
    });
  }

  private itemGroup(product: Pick<PricingProduct, 'id' | 'name' | 'sku'>, price: string) {
    return this.formBuilder.nonNullable.group({
      productId: [product.id, Validators.required],
      productName: [product.name],
      sku: [product.sku],
      price: [price, [Validators.required, Validators.pattern(MONEY)]],
    });
  }
}

function localDate(value: string): string {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}
