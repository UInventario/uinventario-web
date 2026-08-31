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
  PricingCustomer,
  PricingProduct,
  Promotion,
  PromotionInput,
  PromotionType,
} from '../../domain/pricing.models';

const QUANTITY = /^(?:[1-9]\d{0,11}(?:\.\d{1,3})?|0\.(?:00[1-9]|0[1-9]\d?|[1-9]\d{0,2}))$/;
const PERCENT = /^(?:100(?:\.0{1,4})?|(?:[1-9]\d?|0\.\d{0,3}[1-9]|[1-9]\d?\.\d{1,4}))$/;
const MONEY = /^(?:[1-9]\d{0,11}(?:\.\d{1,2})?|0\.(?:0[1-9]|[1-9]\d?))$/;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  selector: 'ui-promotion-editor',
  styleUrl: './promotion-editor.scss',
  templateUrl: './promotion-editor.html',
})
export class PromotionEditor implements OnInit {
  private readonly pricing = inject(PricingFacade);
  private readonly fb = inject(FormBuilder);
  readonly current = input<Promotion | null>(null);
  readonly branch = input<{ readonly id: string; readonly name: string } | null>(null);
  readonly busy = input(false);
  readonly saveError = input<string | null>(null);
  readonly closed = output<void>();
  readonly submitted = output<PromotionInput>();
  protected readonly products = signal<readonly PricingProduct[]>([]);
  protected readonly customers = signal<readonly PricingCustomer[]>([]);
  protected readonly customer = signal<PricingCustomer | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly types: readonly { value: PromotionType; label: string }[] = [
    { value: 'BUY_X_GET_Y', label: 'Compra X y recibe Y' },
    { value: 'SECOND_UNIT_PERCENT', label: 'Descuento en segunda unidad' },
    { value: 'BUNDLE_FIXED', label: 'Paquete a precio fijo' },
    { value: 'QUANTITY_PERCENT', label: 'Descuento por cantidad' },
  ];
  protected readonly channels: readonly { value: PriceChannel | ''; label: string }[] = [
    { value: '', label: 'Todos' },
    { value: 'POS', label: 'Punto de venta' },
    { value: 'WEB', label: 'Web' },
    { value: 'MOBILE', label: 'Móvil' },
    { value: 'DESKTOP', label: 'Escritorio' },
  ];
  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    type: ['SECOND_UNIT_PERCENT' as PromotionType],
    scope: ['GLOBAL' as 'GLOBAL' | 'BRANCH'],
    channel: ['' as PriceChannel | ''],
    priority: [0, [Validators.min(-100000), Validators.max(100000)]],
    stackable: [false],
    validFrom: ['', Validators.required],
    validTo: [''],
    active: [true],
    discountPercent: [''],
    fixedPrice: [''],
    buyQuantity: [''],
    rewardQuantity: [''],
    productId: [''],
    productQuery: [''],
    customerQuery: [''],
    products: this.fb.array([] as ReturnType<PromotionEditor['productGroup']>[]),
    tiers: this.fb.array([] as ReturnType<PromotionEditor['tierGroup']>[]),
  });
  protected get productRows(): FormArray<ReturnType<PromotionEditor['productGroup']>> {
    return this.form.controls.products;
  }
  protected get tierRows(): FormArray<ReturnType<PromotionEditor['tierGroup']>> {
    return this.form.controls.tiers;
  }

  ngOnInit(): void {
    const current = this.current();
    this.form.patchValue({
      name: current?.name ?? '',
      type: current?.type ?? 'SECOND_UNIT_PERCENT',
      scope: current?.scope.branch ? 'BRANCH' : 'GLOBAL',
      channel: current?.scope.channel ?? '',
      priority: current?.priority ?? 0,
      stackable: current?.stackable ?? false,
      validFrom: localDate(current?.validFrom ?? new Date().toISOString()),
      validTo: current?.validTo ? localDate(current.validTo) : '',
      active: current?.active ?? true,
      discountPercent: current?.discountPercent ?? '',
      fixedPrice: current?.fixedPrice ?? '',
      buyQuantity: current?.buyQuantity ?? '',
      rewardQuantity: current?.rewardQuantity ?? '',
    });
    if (current?.scope.customer)
      this.customer.set({ ...current.scope.customer, identifier: null, email: null });
    current?.products.forEach((row) =>
      this.productRows.push(this.productGroup(row.product, row.quantity)),
    );
    current?.tiers.forEach((row) =>
      this.tierRows.push(this.tierGroup(row.minimumQuantity, row.discountPercent)),
    );
    this.loadProducts('');
  }

  protected loadProducts(query = this.form.controls.productQuery.value): void {
    this.loading.set(true);
    this.pricing
      .searchProducts(query)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (value) => this.products.set(value),
        error: () => this.error.set('No fue posible consultar productos.'),
      });
  }
  protected addProduct(): void {
    const id = this.form.controls.productId.value;
    const product = this.products().find((item) => item.id === id);
    if (!product || this.productRows.controls.some((item) => item.controls.productId.value === id))
      return;
    this.productRows.push(this.productGroup(product, '1'));
    this.form.controls.productId.setValue('');
  }
  protected searchCustomers(): void {
    const query = this.form.controls.customerQuery.value.trim();
    if (query.length < 2) return;
    this.pricing.searchCustomers(query).subscribe({
      next: (value) => this.customers.set(value),
      error: () => this.error.set('No fue posible consultar clientes.'),
    });
  }
  protected chooseCustomer(value: PricingCustomer): void {
    this.customer.set(value);
    this.customers.set([]);
    this.form.controls.customerQuery.setValue('');
  }
  protected addTier(): void {
    this.tierRows.push(this.tierGroup('', ''));
  }

  protected submit(): void {
    if (this.busy()) return;
    const value = this.form.getRawValue();
    const type = value.type;
    const productCountValid =
      type === 'BUNDLE_FIXED' ? value.products.length >= 2 : value.products.length === 1;
    const ruleValid =
      (type === 'BUY_X_GET_Y' &&
        PERCENT.test(value.discountPercent) &&
        QUANTITY.test(value.buyQuantity) &&
        QUANTITY.test(value.rewardQuantity) &&
        Number(value.rewardQuantity) <= Number(value.buyQuantity)) ||
      (type === 'SECOND_UNIT_PERCENT' && PERCENT.test(value.discountPercent)) ||
      (type === 'BUNDLE_FIXED' && MONEY.test(value.fixedPrice)) ||
      (type === 'QUANTITY_PERCENT' &&
        value.tiers.length > 0 &&
        value.tiers.every(
          (tier) =>
            QUANTITY.test(tier.minimumQuantity) &&
            PERCENT.test(tier.discountPercent) &&
            Number(tier.discountPercent) <= 50,
        ));
    if (this.form.invalid || !productCountValid || !ruleValid) {
      this.form.markAllAsTouched();
      this.error.set(
        'Revisa la regla: un producto salvo paquetes, y completa cantidades, porcentaje o precio requeridos.',
      );
      return;
    }
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
      type,
      priority: Number(value.priority),
      stackable: value.stackable,
      active: value.active,
      validFrom: new Date(value.validFrom).toISOString(),
      ...(value.validTo ? { validTo: new Date(value.validTo).toISOString() } : {}),
      ...(branchId ? { branchId } : {}),
      ...(this.customer() ? { customerId: this.customer()!.id } : {}),
      ...(value.channel ? { channel: value.channel } : {}),
      ...(type === 'BUY_X_GET_Y' || type === 'SECOND_UNIT_PERCENT'
        ? { discountPercent: value.discountPercent }
        : {}),
      ...(type === 'BUNDLE_FIXED' ? { fixedPrice: value.fixedPrice } : {}),
      ...(type === 'BUY_X_GET_Y'
        ? { buyQuantity: value.buyQuantity, rewardQuantity: value.rewardQuantity }
        : {}),
      products: value.products.map(({ productId, quantity }) => ({ productId, quantity })),
      tiers: type === 'QUANTITY_PERCENT' ? value.tiers : [],
    });
  }
  private productGroup(product: Pick<PricingProduct, 'id' | 'name' | 'sku'>, quantity: string) {
    return this.fb.nonNullable.group({
      productId: [product.id, Validators.required],
      productName: [product.name],
      sku: [product.sku],
      quantity: [quantity, [Validators.required, Validators.pattern(QUANTITY)]],
    });
  }
  private tierGroup(minimumQuantity: string, discountPercent: string) {
    return this.fb.nonNullable.group({
      minimumQuantity: [minimumQuantity, [Validators.required, Validators.pattern(QUANTITY)]],
      discountPercent: [discountPercent, [Validators.required, Validators.pattern(PERCENT)]],
    });
  }
}
function localDate(value: string): string {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}
