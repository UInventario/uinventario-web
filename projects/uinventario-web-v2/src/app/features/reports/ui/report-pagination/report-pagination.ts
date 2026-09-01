import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ReportPagination } from '../../domain/report.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'ui-report-pagination',
  template: `
    <footer class="pagination" aria-label="Paginación del reporte">
      <span>{{ pagination().total }} registro(s)</span>
      <div>
        <button
          type="button"
          [disabled]="pagination().page <= 1"
          (click)="pageChange.emit(pagination().page - 1)"
        >
          Anterior
        </button>
        <span>Página {{ pagination().page }} de {{ pagination().totalPages || 1 }}</span>
        <button
          type="button"
          [disabled]="pagination().page >= pagination().totalPages"
          (click)="pageChange.emit(pagination().page + 1)"
        >
          Siguiente
        </button>
      </div>
    </footer>
  `,
  styles: `
    .pagination,
    .pagination div {
      align-items: center;
      display: flex;
      gap: 0.75rem;
    }
    .pagination {
      color: var(--p-text-muted-color);
      justify-content: space-between;
      padding: 0.8rem 0;
    }
    button {
      background: white;
      border: 1px solid var(--p-surface-300);
      border-radius: var(--radius-md);
      cursor: pointer;
      min-height: 2.4rem;
      padding: 0 0.8rem;
    }
    button:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
    @media (max-width: 36rem) {
      .pagination {
        align-items: stretch;
        flex-direction: column;
      }
      .pagination div {
        justify-content: space-between;
      }
    }
  `,
})
export class ReportPaginationComponent {
  readonly pagination = input.required<ReportPagination>();
  readonly pageChange = output<number>();
}
