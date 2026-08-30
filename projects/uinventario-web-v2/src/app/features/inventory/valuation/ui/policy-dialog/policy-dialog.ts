import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ValuationMigrationPlan,
  ValuationMethod,
  ValuationPolicy,
} from '../../domain/valuation.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  selector: 'ui-policy-dialog',
  styleUrl: './policy-dialog.scss',
  templateUrl: './policy-dialog.html',
})
export class PolicyDialog {
  readonly policy = input.required<ValuationPolicy>();
  readonly plan = input<ValuationMigrationPlan | null>(null);
  readonly previewing = input(false);
  readonly saving = input(false);
  readonly error = input<string | null>(null);
  readonly closed = output<void>();
  readonly methodChanged = output<void>();
  readonly previewRequested = output<ValuationMethod>();
  readonly confirmed = output<ValuationMigrationPlan>();
  protected readonly form = new FormBuilder().nonNullable.group({
    targetMethod: ['FIFO' as ValuationMethod, Validators.required],
    acknowledged: [false, Validators.requiredTrue],
  });
  protected readonly methods: readonly { value: ValuationMethod; label: string }[] = [
    { value: 'MOVING_AVERAGE', label: 'Promedio móvil' },
    { value: 'FIFO', label: 'FIFO' },
    { value: 'SPECIFIC_LOT', label: 'Lote específico' },
  ];

  protected preview(): void {
    const method = this.form.controls.targetMethod.value;
    if (method === this.policy().method || this.previewing()) return;
    this.previewRequested.emit(method);
  }

  protected confirm(): void {
    const plan = this.plan();
    if (
      !plan ||
      !plan.allowed ||
      plan.targetMethod !== this.form.controls.targetMethod.value ||
      this.form.invalid ||
      this.saving()
    )
      return;
    this.confirmed.emit(plan);
  }

  protected methodLabel(method: ValuationMethod): string {
    return this.methods.find((candidate) => candidate.value === method)?.label ?? method;
  }

  protected strategyLabel(strategy: ValuationMigrationPlan['strategy']): string {
    return {
      USE_MAINTAINED_MOVING_AVERAGE: 'Usar la proyección de promedio mantenida',
      USE_MAINTAINED_FIFO_LAYERS: 'Usar las capas FIFO mantenidas',
      OPENING_LOTS_AT_MOVING_AVERAGE: 'Abrir lotes al costo promedio vigente',
    }[strategy];
  }

  protected blockerLabel(reason: string): string {
    return (
      (
        {
          METHOD_ALREADY_ACTIVE: 'El método seleccionado ya está activo.',
          FIFO_LAYER_RECONCILIATION_REQUIRED: 'Las capas FIFO deben conciliar antes del cambio.',
          LOT_RECONCILIATION_REQUIRED: 'Los lotes deben conciliar antes del cambio.',
        } as Record<string, string>
      )[reason] ?? reason
    );
  }
}
