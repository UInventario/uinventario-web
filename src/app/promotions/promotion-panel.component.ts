import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { ProductApiService, ProductData } from '../catalog/product-api.service';
import { CustomerApiService, CustomerData } from '../customers/customer-api.service';
import {
  OrganizationApiService,
  OrganizationBranchData,
} from '../organization/organization-api.service';
import {
  PromotionApiService,
  PromotionData,
  PromotionInput,
  PromotionType,
} from './promotion-api.service';

const POSITIVE_QUANTITY = /^(?:[1-9]\d{0,11}(?:\.\d{1,3})?|0\.(?:00[1-9]|0[1-9]\d?|[1-9]\d{0,2}))$/;
const POSITIVE_PERCENT = /^(?:100(?:\.0{1,4})?|(?:[1-9]\d?|0\.\d{0,3}[1-9]|[1-9]\d?\.\d{1,4}))$/;
const POSITIVE_MONEY = /^(?:[1-9]\d{0,11}(?:\.\d{1,2})?|0\.(?:0[1-9]|[1-9]\d?))$/;

@Component({
  selector: 'app-promotion-panel',
  imports: [ReactiveFormsModule],
  templateUrl: './promotion-panel.component.html',
  styleUrl: './promotion-panel.component.scss',
})
export class PromotionPanelComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(PromotionApiService);
  private readonly productsApi = inject(ProductApiService);
  private readonly customersApi = inject(CustomerApiService);
  private readonly organizationApi = inject(OrganizationApiService);

  protected readonly promotions = signal<PromotionData[]>([]);
  protected readonly products = signal<ProductData[]>([]);
  protected readonly customers = signal<CustomerData[]>([]);
  protected readonly branches = signal<OrganizationBranchData[]>([]);
  protected readonly editing = signal<PromotionData | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    type: ['BUY_X_GET_Y' as PromotionType, Validators.required],
    branchId: [''],
    customerId: [''],
    channel: ['POS'],
    priority: [0, [Validators.required, Validators.min(-100000), Validators.max(100000)]],
    stackable: [false],
    validFrom: [this.localDateTime(new Date()), Validators.required],
    validTo: [''],
    active: [true],
    discountPercent: ['100', Validators.pattern(POSITIVE_PERCENT)],
    fixedPrice: ['', Validators.pattern(POSITIVE_MONEY)],
    buyQuantity: ['1', Validators.pattern(POSITIVE_QUANTITY)],
    rewardQuantity: ['1', Validators.pattern(POSITIVE_QUANTITY)],
    products: this.fb.array([this.productGroup()]),
    tiers: this.fb.array([this.tierGroup()]),
  });

  protected get promotionProducts(): FormArray<
    ReturnType<PromotionPanelComponent['productGroup']>
  > {
    return this.form.controls.products;
  }

  protected get tiers(): FormArray<ReturnType<PromotionPanelComponent['tierGroup']>> {
    return this.form.controls.tiers;
  }

  ngOnInit(): void {
    this.syncRuleValidators(this.form.controls.type.value);
    this.form.controls.type.valueChanges.subscribe((type) => this.syncRuleValidators(type));
    this.load();
    forkJoin({
      products: this.productsApi.list({ status: 'ACTIVE', page: 1, pageSize: 100 }),
      customers: this.customersApi.list({ status: 'ACTIVE', page: 1, pageSize: 100 }),
      branches: this.organizationApi.list(),
    }).subscribe({
      next: ({ products, customers, branches }) => {
        this.products.set(products.data.filter((product) => product.sellable !== false));
        this.customers.set(customers.data);
        this.branches.set(branches.data.filter((branch) => branch.active));
      },
      error: () => this.error.set('No fue posible cargar las opciones de promociones.'),
    });
  }

  protected addProduct(): void {
    if (this.promotionProducts.length < 50) this.promotionProducts.push(this.productGroup());
  }

  protected removeProduct(index: number): void {
    if (this.promotionProducts.length > 1) this.promotionProducts.removeAt(index);
  }

  protected addTier(): void {
    if (this.tiers.length < 20) {
      this.tiers.push(this.tierGroup());
      this.syncRuleValidators(this.form.controls.type.value);
    }
  }

  protected removeTier(index: number): void {
    if (this.tiers.length > 1) this.tiers.removeAt(index);
  }

  protected edit(promotion: PromotionData): void {
    this.editing.set(promotion);
    this.form.patchValue({
      name: promotion.name,
      type: promotion.type,
      branchId: promotion.scope.branch?.id ?? '',
      customerId: promotion.scope.customer?.id ?? '',
      channel: promotion.scope.channel ?? '',
      priority: promotion.priority,
      stackable: promotion.stackable,
      validFrom: this.localDateTime(new Date(promotion.validFrom)),
      validTo: promotion.validTo ? this.localDateTime(new Date(promotion.validTo)) : '',
      active: promotion.active,
      discountPercent: promotion.discountPercent ?? '',
      fixedPrice: promotion.fixedPrice ?? '',
      buyQuantity: promotion.buyQuantity ?? '',
      rewardQuantity: promotion.rewardQuantity ?? '',
    });
    this.promotionProducts.clear();
    promotion.products.forEach((item) =>
      this.promotionProducts.push(this.productGroup(item.product.id, item.quantity)),
    );
    this.tiers.clear();
    (promotion.tiers.length
      ? promotion.tiers
      : [{ minimumQuantity: '', discountPercent: '' }]
    ).forEach((tier) =>
      this.tiers.push(this.tierGroup(tier.minimumQuantity, tier.discountPercent)),
    );
    this.syncRuleValidators(promotion.type);
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
    if (new Set(raw.products.map((item) => item.productId)).size !== raw.products.length) {
      this.error.set('Cada producto puede aparecer una sola vez.');
      return;
    }
    if (raw.type === 'BUNDLE_FIXED' ? raw.products.length < 2 : raw.products.length !== 1) {
      this.error.set(
        raw.type === 'BUNDLE_FIXED'
          ? 'Un combo requiere al menos dos productos.'
          : 'Esta promoción requiere exactamente un producto.',
      );
      return;
    }
    if (raw.type === 'QUANTITY_PERCENT' && !raw.tiers.length) {
      this.error.set('Agrega al menos una escala de cantidad.');
      return;
    }
    if (raw.validTo && new Date(raw.validTo) <= new Date(raw.validFrom)) {
      this.error.set('El fin de vigencia debe ser posterior al inicio.');
      return;
    }
    const input: PromotionInput = {
      name: raw.name.trim(),
      type: raw.type,
      ...(raw.branchId ? { branchId: raw.branchId } : {}),
      ...(raw.customerId ? { customerId: raw.customerId } : {}),
      ...(raw.channel ? { channel: raw.channel as PromotionInput['channel'] } : {}),
      priority: Number(raw.priority),
      stackable: raw.stackable,
      validFrom: new Date(raw.validFrom).toISOString(),
      ...(raw.validTo ? { validTo: new Date(raw.validTo).toISOString() } : {}),
      active: raw.active,
      ...(raw.type === 'BUY_X_GET_Y' || raw.type === 'SECOND_UNIT_PERCENT'
        ? { discountPercent: raw.discountPercent.trim() }
        : {}),
      ...(raw.type === 'BUY_X_GET_Y'
        ? { buyQuantity: raw.buyQuantity.trim(), rewardQuantity: raw.rewardQuantity.trim() }
        : {}),
      ...(raw.type === 'BUNDLE_FIXED' ? { fixedPrice: raw.fixedPrice.trim() } : {}),
      products: raw.products.map((item) => ({
        productId: item.productId,
        quantity: item.quantity.trim(),
      })),
      tiers:
        raw.type === 'QUANTITY_PERCENT'
          ? raw.tiers.map((tier) => ({
              minimumQuantity: tier.minimumQuantity.trim(),
              discountPercent: tier.discountPercent.trim(),
            }))
          : [],
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
        this.success.set(current ? 'Promoción actualizada.' : 'Promoción creada.');
        this.editing.set(null);
        this.reset();
        this.load();
      },
      error: (response: HttpErrorResponse) => {
        const code = (response.error as { code?: string } | null)?.code;
        this.error.set(
          code === 'PROMOTION_VERSION_CONFLICT'
            ? 'La promoción cambió; recarga antes de guardar.'
            : code === 'PROMOTION_MARGIN_LIMIT'
              ? 'Las escalas de cantidad no pueden superar 50%.'
              : 'No fue posible guardar la promoción.',
        );
        if (code === 'PROMOTION_VERSION_CONFLICT') this.load();
      },
    });
  }

  protected typeLabel(type: PromotionType): string {
    return {
      BUY_X_GET_Y: 'Compra X y recibe Y',
      SECOND_UNIT_PERCENT: 'Segunda unidad',
      BUNDLE_FIXED: 'Combo a precio fijo',
      QUANTITY_PERCENT: 'Escalas por cantidad',
    }[type];
  }

  private load(): void {
    this.loading.set(true);
    this.api
      .list()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ data }) => this.promotions.set(data),
        error: () => this.error.set('No fue posible cargar las promociones.'),
      });
  }

  private reset(): void {
    this.form.reset({
      name: '',
      type: 'BUY_X_GET_Y',
      branchId: '',
      customerId: '',
      channel: 'POS',
      priority: 0,
      stackable: false,
      validFrom: this.localDateTime(new Date()),
      validTo: '',
      active: true,
      discountPercent: '100',
      fixedPrice: '',
      buyQuantity: '1',
      rewardQuantity: '1',
      products: [],
      tiers: [],
    });
    this.promotionProducts.clear();
    this.promotionProducts.push(this.productGroup());
    this.tiers.clear();
    this.tiers.push(this.tierGroup());
    this.syncRuleValidators('BUY_X_GET_Y');
  }

  private productGroup(productId = '', quantity = '1') {
    return this.fb.nonNullable.group({
      productId: [productId, Validators.required],
      quantity: [quantity, [Validators.required, Validators.pattern(POSITIVE_QUANTITY)]],
    });
  }

  private tierGroup(minimumQuantity = '', discountPercent = '') {
    return this.fb.nonNullable.group({
      minimumQuantity: [minimumQuantity, Validators.pattern(POSITIVE_QUANTITY)],
      discountPercent: [discountPercent, Validators.pattern(POSITIVE_PERCENT)],
    });
  }

  private syncRuleValidators(type: PromotionType): void {
    if (type === 'BUNDLE_FIXED' && this.promotionProducts.length < 2) {
      this.promotionProducts.push(this.productGroup());
    }
    while (type !== 'BUNDLE_FIXED' && this.promotionProducts.length > 1) {
      this.promotionProducts.removeAt(this.promotionProducts.length - 1);
    }
    const requiredPattern = (pattern: RegExp, required: boolean) =>
      required ? [Validators.required, Validators.pattern(pattern)] : [Validators.pattern(pattern)];
    this.form.controls.discountPercent.setValidators(
      requiredPattern(POSITIVE_PERCENT, type === 'BUY_X_GET_Y' || type === 'SECOND_UNIT_PERCENT'),
    );
    this.form.controls.fixedPrice.setValidators(
      requiredPattern(POSITIVE_MONEY, type === 'BUNDLE_FIXED'),
    );
    this.form.controls.buyQuantity.setValidators(
      requiredPattern(POSITIVE_QUANTITY, type === 'BUY_X_GET_Y'),
    );
    this.form.controls.rewardQuantity.setValidators(
      requiredPattern(POSITIVE_QUANTITY, type === 'BUY_X_GET_Y'),
    );
    for (const tier of this.tiers.controls) {
      tier.controls.minimumQuantity.setValidators(
        requiredPattern(POSITIVE_QUANTITY, type === 'QUANTITY_PERCENT'),
      );
      tier.controls.discountPercent.setValidators(
        requiredPattern(POSITIVE_PERCENT, type === 'QUANTITY_PERCENT'),
      );
      tier.updateValueAndValidity({ emitEvent: false });
    }
    this.form.controls.discountPercent.updateValueAndValidity({ emitEvent: false });
    this.form.controls.fixedPrice.updateValueAndValidity({ emitEvent: false });
    this.form.controls.buyQuantity.updateValueAndValidity({ emitEvent: false });
    this.form.controls.rewardQuantity.updateValueAndValidity({ emitEvent: false });
  }

  private localDateTime(date: Date): string {
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }
}
