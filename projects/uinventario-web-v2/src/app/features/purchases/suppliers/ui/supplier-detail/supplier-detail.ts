import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Supplier, SupplierProduct, SupplierProductPage } from '../../domain/supplier.models';
import { SupplierProductList } from '../supplier-product-list/supplier-product-list';

export type SupplierDetailTab = 'CONTACTS' | 'PRODUCTS';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, SupplierProductList],
  selector: 'ui-supplier-detail',
  styleUrl: './supplier-detail.scss',
  templateUrl: './supplier-detail.html',
})
export class SupplierDetail {
  readonly supplier = input<Supplier | null>(null);
  readonly tab = input<SupplierDetailTab>('CONTACTS');
  readonly products = input<SupplierProductPage | null>(null);
  readonly productsLoading = input(false);
  readonly productFilter = input('');
  readonly editRequested = output<Supplier>();
  readonly retirementRequested = output<Supplier>();
  readonly tabChanged = output<SupplierDetailTab>();
  readonly productCreateRequested = output<void>();
  readonly productEditRequested = output<SupplierProduct>();
  readonly productFilterChanged = output<string>();
  readonly productPageChanged = output<number>();
}
