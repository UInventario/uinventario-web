import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, linkedSignal, output } from '@angular/core';
import { Supplier, SupplierProduct, SupplierProductPage } from '../../domain/supplier.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  selector: 'ui-supplier-product-list',
  styleUrl: './supplier-product-list.scss',
  templateUrl: './supplier-product-list.html',
})
export class SupplierProductList {
  readonly supplier = input.required<Supplier>();
  readonly page = input<SupplierProductPage | null>(null);
  readonly loading = input(false);
  readonly filter = input('');
  readonly createRequested = output<void>();
  readonly editRequested = output<SupplierProduct>();
  readonly filterChanged = output<string>();
  readonly pageChanged = output<number>();
  protected readonly filterDraft = linkedSignal(() => this.filter());

  protected updateFilter(event: Event): void {
    this.filterDraft.set((event.target as HTMLInputElement).value);
  }

  protected applyFilter(): void {
    this.filterChanged.emit(this.filterDraft());
  }
}
