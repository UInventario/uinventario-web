import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { CatalogFacade } from '../../application/catalog.facade';
import { Product } from '../../domain/catalog.models';
import { ProductKitWorkspace } from '../product-kit-workspace/product-kit-workspace';
import { ProductVariantsWorkspace } from '../product-variants-workspace/product-variants-workspace';

type AdvancedTab = 'VARIANTS' | 'KIT';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProductKitWorkspace, ProductVariantsWorkspace],
  selector: 'ui-advanced-product-page',
  styleUrl: './advanced-product-page.scss',
  templateUrl: './advanced-product-page.html',
})
export class AdvancedProductPage implements OnInit {
  private readonly catalog = inject(CatalogFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly product = signal<Product | null>(null);
  protected readonly candidates = signal<readonly Product[]>([]);
  protected readonly activeTab = signal<AdvancedTab>('VARIANTS');

  ngOnInit(): void {
    this.load();
  }

  protected selectTab(tab: AdvancedTab): void {
    this.activeTab.set(tab);
  }

  protected productSaved(product: Product): void {
    this.product.set(product);
  }

  protected backToCatalog(): void {
    void this.router.navigate(['/app/catalogo']);
  }

  protected retry(): void {
    this.load();
  }

  protected unitLabel(product: Product): string {
    const units: Record<Product['baseUnit'], string> = {
      UNIT: 'unidad',
      KILOGRAM: 'kg',
      GRAM: 'g',
      LITER: 'l',
      MILLILITER: 'ml',
      METER: 'm',
      CENTIMETER: 'cm',
    };
    return units[product.baseUnit];
  }

  private load(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('No se indicó qué producto configurar.');
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      product: this.catalog.getProduct(id),
      candidates: this.catalog.listProducts({ status: 'ACTIVE', page: 1, pageSize: 100 }),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ product, candidates }) => {
          this.product.set(product);
          this.candidates.set(candidates.products);
        },
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  private messageFor(error: unknown): string {
    if (!(error instanceof ApiError)) return 'No fue posible cargar la configuración avanzada.';
    if (error.status === 404) return 'El producto ya no existe o no está disponible.';
    if (error.kind === 'forbidden') return 'No tienes permiso para configurar este producto.';
    return error.message;
  }
}
