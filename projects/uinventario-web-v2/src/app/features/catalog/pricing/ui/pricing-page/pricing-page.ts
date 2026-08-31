import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin, of } from 'rxjs';
import { ApiError } from '../../../../../core/api/api-error';
import { AuthorizationService } from '../../../../../core/authorization/authorization.service';
import { SessionState } from '../../../../../core/session/session-state';
import { PricingFacade } from '../../application/pricing.facade';
import {
  LoyaltyRule,
  LoyaltyRuleInput,
  PriceList,
  PriceListInput,
  Promotion,
  PromotionInput,
  PromotionType,
} from '../../domain/pricing.models';
import { PriceListEditor } from '../price-list-editor/price-list-editor';
import { PromotionEditor } from '../promotion-editor/promotion-editor';

type PricingTab = 'LISTS' | 'PROMOTIONS' | 'LOYALTY';
const MONEY = /^(?:[1-9]\d{0,11}(?:\.\d{1,2})?|0\.(?:0[1-9]|[1-9]\d?))$/;
const INTEGER = /^\d+$/;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PriceListEditor, PromotionEditor, ReactiveFormsModule, RouterLink],
  selector: 'ui-pricing-page',
  styleUrls: ['./pricing-page.scss', './pricing-cards.scss'],
  templateUrl: './pricing-page.html',
})
export class PricingPage implements OnInit {
  private readonly pricing = inject(PricingFacade);
  private readonly sessions = inject(SessionState);
  private readonly authorization = inject(AuthorizationService);
  private readonly fb = inject(FormBuilder);
  protected readonly tab = signal<PricingTab>('LISTS');
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly priceListSaveError = signal<string | null>(null);
  protected readonly promotionSaveError = signal<string | null>(null);
  protected readonly priceLists = signal<readonly PriceList[]>([]);
  protected readonly promotions = signal<readonly Promotion[]>([]);
  protected readonly loyalty = signal<LoyaltyRule | null>(null);
  protected readonly editingPriceList = signal<PriceList | null | undefined>(undefined);
  protected readonly editingPromotion = signal<Promotion | null | undefined>(undefined);
  protected readonly branch = computed(() => this.sessions.session()?.context.branch ?? null);
  protected readonly canManageLoyalty = computed(() => this.authorization.has('SALES_MANAGE'));
  protected readonly activePriceLists = computed(
    () => this.priceLists().filter((item) => item.active).length,
  );
  protected readonly activePromotions = computed(
    () => this.promotions().filter((item) => item.active).length,
  );
  protected readonly loyaltyForm = this.fb.nonNullable.group({
    active: [true],
    earnAmount: ['100.00', [Validators.required, Validators.pattern(MONEY)]],
    earnPoints: [1, [Validators.required, Validators.min(1), Validators.pattern(INTEGER)]],
    redeemPoints: [100, [Validators.required, Validators.min(1), Validators.pattern(INTEGER)]],
    redeemAmount: ['10.00', [Validators.required, Validators.pattern(MONEY)]],
    expirationDays: [0, [Validators.min(0), Validators.max(3650), Validators.pattern(INTEGER)]],
  });

  ngOnInit(): void {
    this.reload();
  }
  protected selectTab(tab: PricingTab): void {
    this.tab.set(tab);
    this.clearMessages();
  }
  protected newPriceList(): void {
    this.clearMessages();
    this.priceListSaveError.set(null);
    this.editingPriceList.set(null);
  }
  protected newPromotion(): void {
    this.clearMessages();
    this.promotionSaveError.set(null);
    this.editingPromotion.set(null);
  }
  protected editPriceList(value: PriceList): void {
    this.priceListSaveError.set(null);
    this.editingPriceList.set(value);
  }
  protected closePriceList(): void {
    if (this.saving()) return;
    this.priceListSaveError.set(null);
    this.editingPriceList.set(undefined);
  }
  protected editPromotion(value: Promotion): void {
    this.promotionSaveError.set(null);
    this.editingPromotion.set(value);
  }
  protected closePromotion(): void {
    if (this.saving()) return;
    this.promotionSaveError.set(null);
    this.editingPromotion.set(undefined);
  }

  protected savePriceList(input: PriceListInput): void {
    if (this.saving()) return;
    const current = this.editingPriceList() ?? undefined;
    this.saving.set(true);
    this.error.set(null);
    this.priceListSaveError.set(null);
    this.pricing
      .savePriceList(input, current)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.editingPriceList.set(undefined);
          this.notice.set(current ? 'Lista actualizada.' : 'Lista creada.');
          this.reloadLists();
        },
        error: (error: unknown) =>
          this.priceListSaveError.set(this.messageFor(error, 'No fue posible guardar la lista.')),
      });
  }
  protected savePromotion(input: PromotionInput): void {
    if (this.saving()) return;
    const current = this.editingPromotion() ?? undefined;
    this.saving.set(true);
    this.error.set(null);
    this.promotionSaveError.set(null);
    this.pricing
      .savePromotion(input, current)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.editingPromotion.set(undefined);
          this.notice.set(current ? 'Promoción actualizada.' : 'Promoción creada.');
          this.reloadPromotions();
        },
        error: (error: unknown) =>
          this.promotionSaveError.set(
            this.messageFor(error, 'No fue posible guardar la promoción.'),
          ),
      });
  }
  protected saveLoyalty(): void {
    if (!this.canManageLoyalty() || this.loyaltyForm.invalid || this.saving()) {
      this.loyaltyForm.markAllAsTouched();
      return;
    }
    const value = this.loyaltyForm.getRawValue();
    const input: LoyaltyRuleInput = {
      active: value.active,
      earnAmount: value.earnAmount,
      earnPoints: Number(value.earnPoints),
      redeemPoints: Number(value.redeemPoints),
      redeemAmount: value.redeemAmount,
      ...(value.expirationDays > 0 ? { expirationDays: Number(value.expirationDays) } : {}),
    };
    this.saving.set(true);
    this.error.set(null);
    this.pricing
      .saveLoyaltyRule(input)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (rule) => {
          this.loyalty.set(rule);
          this.setLoyaltyForm(rule);
          this.notice.set(`Regla de fidelidad v${rule.version} publicada.`);
        },
        error: (error: unknown) =>
          this.error.set(this.messageFor(error, 'No fue posible guardar la regla de fidelidad.')),
      });
  }
  protected scopeLabel(scope: PriceList['scope']): string {
    return [scope.branch?.name ?? 'Empresa', scope.customer?.name, scope.channel]
      .filter(Boolean)
      .join(' · ');
  }
  protected promotionLabel(type: PromotionType): string {
    return {
      BUY_X_GET_Y: 'Compra X y recibe Y',
      SECOND_UNIT_PERCENT: 'Segunda unidad',
      BUNDLE_FIXED: 'Paquete fijo',
      QUANTITY_PERCENT: 'Por cantidad',
    }[type];
  }
  protected dateLabel(value: string | null): string {
    return value
      ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(value))
      : 'Sin vencimiento';
  }

  private reload(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      lists: this.pricing.listPriceLists(),
      promotions: this.pricing.listPromotions(),
      loyalty: this.canManageLoyalty() ? this.pricing.currentLoyaltyRule() : of(null),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ lists, promotions, loyalty }) => {
          this.priceLists.set(lists);
          this.promotions.set(promotions);
          this.loyalty.set(loyalty);
          if (loyalty) this.setLoyaltyForm(loyalty);
        },
        error: (error: unknown) =>
          this.error.set(this.messageFor(error, 'No fue posible cargar precios y promociones.')),
      });
  }
  private reloadLists(): void {
    this.pricing.listPriceLists().subscribe({
      next: (value) => this.priceLists.set(value),
      error: (error: unknown) =>
        this.error.set(this.messageFor(error, 'No fue posible actualizar las listas.')),
    });
  }
  private reloadPromotions(): void {
    this.pricing.listPromotions().subscribe({
      next: (value) => this.promotions.set(value),
      error: (error: unknown) =>
        this.error.set(this.messageFor(error, 'No fue posible actualizar promociones.')),
    });
  }
  private setLoyaltyForm(rule: LoyaltyRule): void {
    this.loyaltyForm.setValue({
      active: rule.active,
      earnAmount: rule.earnAmount,
      earnPoints: rule.earnPoints,
      redeemPoints: rule.redeemPoints,
      redeemAmount: rule.redeemAmount,
      expirationDays: rule.expirationDays ?? 0,
    });
  }
  private clearMessages(): void {
    this.error.set(null);
    this.notice.set(null);
  }
  private messageFor(error: unknown, fallback: string): string {
    if (!(error instanceof ApiError)) return fallback;
    const messages: Record<string, string> = {
      PRICE_LIST_VERSION_CONFLICT: 'La lista cambió; vuelve a abrirla.',
      PROMOTION_VERSION_CONFLICT: 'La promoción cambió; vuelve a abrirla.',
      PROMOTION_MARGIN_LIMIT: 'El descuento por cantidad no puede superar 50%.',
      PROMOTION_INVALID_RULE: 'La combinación de regla y valores no es válida.',
      PROMOTION_INVALID_PRODUCTS: 'Selecciona un producto, o dos o más si es un paquete.',
    };
    return messages[error.code] ?? error.message;
  }
}
