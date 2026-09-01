import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Supplier, SupplierPage } from '../../domain/supplier.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'ui-supplier-list',
  styleUrl: './supplier-list.scss',
  templateUrl: './supplier-list.html',
})
export class SupplierList {
  readonly page = input<SupplierPage | null>(null);
  readonly loading = input(false);
  readonly selectedId = input<string | null>(null);
  readonly selected = output<Supplier>();
  readonly pageChanged = output<number>();
}
