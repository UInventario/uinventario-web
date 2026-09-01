import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ValuationStockItem, ValuationStockPage } from '../../domain/valuation.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'ui-valuation-stock-list',
  styleUrl: './valuation-stock-list.scss',
  templateUrl: './valuation-stock-list.html',
})
export class ValuationStockList {
  readonly page = input<ValuationStockPage | null>(null);
  readonly loading = input(false);
  readonly selectedId = input<string | null>(null);
  readonly selected = output<ValuationStockItem>();
  readonly pageChanged = output<number>();

  protected methodLabel(method: ValuationStockItem['costing']['method']): string {
    return {
      MOVING_AVERAGE: 'Promedio móvil',
      FIFO: 'FIFO',
      SPECIFIC_LOT: 'Lote específico',
    }[method];
  }
}
