import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../../core/api/api-error';
import { AuthorizationService } from '../../../../../core/authorization/authorization.service';
import { CustomerFacade } from '../../application/customer.facade';
import {
  CreditInput,
  Customer,
  CustomerInput,
  CustomerPage as CustomerPageData,
  CustomerQuery,
  CustomerStatus,
  PrivacyPolicy,
  PrivacyPolicyInput,
} from '../../domain/customer.models';
import { CustomerCreditDialog } from '../credit-dialog/credit-dialog';
import { CustomerDetailDialog } from '../customer-detail-dialog/customer-detail-dialog';
import { CustomerEditorDialog } from '../customer-editor-dialog/customer-editor-dialog';
import { PrivacyPolicyPanel } from '../privacy-policy-panel/privacy-policy-panel';

type CustomerTab = 'CUSTOMERS' | 'POLICY';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CustomerCreditDialog,
    CustomerDetailDialog,
    CustomerEditorDialog,
    PrivacyPolicyPanel,
    ReactiveFormsModule,
  ],
  selector: 'ui-customer-page',
  styleUrls: ['./customer-page.scss', './customer-responsive.scss'],
  templateUrl: './customer-page.html',
})
export class CustomerPage implements OnInit {
  private readonly facade = inject(CustomerFacade);
  private readonly authorization = inject(AuthorizationService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private loadRevision = 0;

  protected readonly tab = signal<CustomerTab>('CUSTOMERS');
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly page = signal<CustomerPageData | null>(null);
  protected readonly policy = signal<PrivacyPolicy | null>(null);
  protected readonly editor = signal<Customer | null | undefined>(undefined);
  protected readonly detail = signal<Customer | null>(null);
  protected readonly creditEditor = signal<Customer | null>(null);
  protected readonly retirement = signal<Customer | null>(null);
  protected readonly retirementConfirmation = signal('');
  protected readonly canCredit = computed(() => this.authorization.has('SALES_CREDIT'));
  protected readonly canPrivacy = computed(() => this.authorization.has('PRIVACY_MANAGE'));
  protected readonly filters = this.formBuilder.nonNullable.group({
    q: [''],
    status: ['ACTIVE' as CustomerStatus],
  });

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const policyTab = params.get('view') === 'privacy' && this.canPrivacy();
      this.tab.set(policyTab ? 'POLICY' : 'CUSTOMERS');
      if (policyTab) this.loadPolicy();
      else {
        const query = this.queryFrom(params);
        this.filters.setValue({ q: query.q ?? '', status: query.status });
        this.load(query);
      }
    });
  }

  protected selectTab(tab: CustomerTab): void {
    if (tab === 'POLICY' && !this.canPrivacy()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: tab === 'POLICY' ? { view: 'privacy' } : {},
    });
  }

  protected applyFilters(): void {
    const value = this.filters.getRawValue();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: value.q.trim() || null,
        status: value.status === 'ACTIVE' ? null : value.status,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected goToPage(page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: page <= 1 ? null : page },
      queryParamsHandling: 'merge',
    });
  }

  protected openCreate(): void {
    this.clearMessages();
    this.editor.set(null);
  }

  protected openEdit(customer: Customer): void {
    if (customer.privacyStatus === 'ANONYMIZED') return;
    this.clearMessages();
    this.editor.set(customer);
  }

  protected closeEditor(): void {
    if (!this.saving()) this.editor.set(undefined);
  }

  protected saveCustomer(input: CustomerInput): void {
    const current = this.editor() ?? undefined;
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.facade
      .save(input, current)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.editor.set(undefined);
          this.notice.set(current ? 'Cliente actualizado.' : 'Cliente creado.');
          this.refresh();
        },
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  protected requestRetirement(customer: Customer): void {
    this.clearMessages();
    this.retirementConfirmation.set('');
    this.retirement.set(customer);
  }

  protected updateRetirement(event: Event): void {
    this.retirementConfirmation.set((event.target as HTMLInputElement).value);
  }

  protected confirmRetirement(): void {
    const customer = this.retirement();
    if (!customer || this.retirementConfirmation().trim() !== customer.name || this.saving())
      return;
    this.saving.set(true);
    this.facade
      .deactivate(customer.id)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.retirement.set(null);
          this.notice.set('Cliente desactivado; su historial se conserva.');
          this.refresh();
        },
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  protected saveCredit(input: CreditInput): void {
    const customer = this.creditEditor();
    if (!customer || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.facade
      .configureCredit(customer.id, input)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.creditEditor.set(null);
          this.notice.set('Configuración de crédito actualizada.');
          this.refresh();
        },
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  protected savePolicy(input: PrivacyPolicyInput): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.facade
      .updatePrivacyPolicy(input)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (policy) => {
          this.policy.set(policy);
          this.notice.set('Política de retención actualizada y auditada.');
        },
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  protected refreshAfterDetailChange(): void {
    this.detail.set(null);
    this.refresh();
  }

  private refresh(): void {
    this.load(this.queryFrom(this.route.snapshot.queryParamMap));
  }

  private load(query: CustomerQuery): void {
    const revision = ++this.loadRevision;
    this.loading.set(true);
    this.error.set(null);
    this.facade
      .list(query)
      .pipe(finalize(() => revision === this.loadRevision && this.loading.set(false)))
      .subscribe({
        next: (page) => revision === this.loadRevision && this.page.set(page),
        error: (error: unknown) =>
          revision === this.loadRevision && this.error.set(this.messageFor(error)),
      });
  }

  private loadPolicy(): void {
    if (this.policy()) return;
    this.loading.set(true);
    this.error.set(null);
    this.facade
      .privacyPolicy()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (policy) => this.policy.set(policy),
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  private queryFrom(params: ParamMap): CustomerQuery {
    const status = params.get('status');
    const page = Number(params.get('page'));
    return {
      q: params.get('q') ?? undefined,
      status: status === 'INACTIVE' || status === 'ALL' ? status : 'ACTIVE',
      page: Number.isInteger(page) && page > 0 ? page : 1,
      pageSize: 20,
    };
  }

  private clearMessages(): void {
    this.error.set(null);
    this.notice.set(null);
  }

  private messageFor(error: unknown): string {
    if (!(error instanceof ApiError)) return 'No fue posible actualizar clientes.';
    const messages: Record<string, string> = {
      CUSTOMER_DUPLICATE: 'Ya existe un cliente con ese identificador o contacto.',
      CUSTOMER_CONSENT_REQUIRED: 'Otorga consentimiento o elimina los datos de contacto.',
      CUSTOMER_VERSION_CONFLICT: 'El cliente cambió. Cierra y vuelve a abrir el editor.',
      PRIVACY_POLICY_VERSION_CONFLICT: 'La política cambió. Recarga antes de guardar.',
      PRIVACY_RETENTION_BELOW_COUNTRY_MINIMUM: 'La retención no puede ser menor al mínimo legal.',
    };
    return (error.code && messages[error.code]) || error.message;
  }
}
