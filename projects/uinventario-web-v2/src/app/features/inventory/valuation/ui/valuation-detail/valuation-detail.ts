import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import {
  FifoLayerSet,
  ValuationStockItem,
  ValuedMovementPage,
} from '../../domain/valuation.models';

type DetailTab = 'SUMMARY' | 'LAYERS' | 'HISTORY';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  selector: 'ui-valuation-detail',
  styleUrls: ['./valuation-detail.scss', './valuation-detail-responsive.scss'],
  templateUrl: './valuation-detail.html',
})
export class ValuationDetail {
  readonly item = input<ValuationStockItem | null>(null);
  readonly layers = input<FifoLayerSet | null>(null);
  readonly movements = input<ValuedMovementPage | null>(null);
  readonly loading = input(false);
  readonly movementPageChanged = output<number>();
  protected readonly tab = signal<DetailTab>('SUMMARY');

  protected methodLabel(method: ValuationStockItem['costing']['method']): string {
    return {
      MOVING_AVERAGE: 'Promedio móvil',
      FIFO: 'FIFO',
      SPECIFIC_LOT: 'Lote específico',
    }[method];
  }

  protected originLabel(origin: string): string {
    return (
      (
        {
          MIGRATION_CUT: 'Saldo de apertura',
          ENTRY: 'Entrada',
          PURCHASE_RECEIPT: 'Recepción de compra',
          RETURN: 'Devolución',
          TRANSFER: 'Transferencia',
        } as Record<string, string>
      )[origin] ?? origin
    );
  }
}
