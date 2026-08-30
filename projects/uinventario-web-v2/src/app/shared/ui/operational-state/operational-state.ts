import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { OperationalStateKind, OperationalStatePresentation } from './operational-state.models';

const PRESENTATIONS: Readonly<Record<OperationalStateKind, OperationalStatePresentation>> = {
  loading: {
    icon: 'pi pi-spin pi-spinner',
    title: 'Cargando información',
    message: 'Estamos preparando los datos más recientes.',
  },
  empty: {
    icon: 'pi pi-inbox',
    title: 'Aún no hay información',
    message: 'Crea el primer registro para comenzar a operar.',
  },
  error: {
    icon: 'pi pi-exclamation-circle',
    title: 'No pudimos completar la operación',
    message: 'Revisa los datos e inténtalo nuevamente.',
  },
  offline: {
    icon: 'pi pi-cloud-off',
    title: 'Sin conexión',
    message: 'Conservaremos tu trabajo y reintentaremos cuando vuelva la red.',
  },
  forbidden: {
    icon: 'pi pi-lock',
    title: 'Permisos insuficientes',
    message: 'Solicita acceso a un administrador de tu empresa.',
  },
};

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, ProgressSpinnerModule],
  selector: 'ui-operational-state',
  styleUrl: './operational-state.scss',
  templateUrl: './operational-state.html',
})
export class OperationalState {
  readonly actionLabel = input<string>();
  readonly kind = input.required<OperationalStateKind>();
  readonly message = input<string>();
  readonly title = input<string>();
  readonly actionInvoked = output<void>();

  protected readonly presentation = computed(() => PRESENTATIONS[this.kind()]);
  protected readonly resolvedMessage = computed(
    () => this.message() ?? this.presentation().message,
  );
  protected readonly resolvedTitle = computed(() => this.title() ?? this.presentation().title);
  protected readonly role = computed(() => (this.kind() === 'error' ? 'alert' : 'status'));
}
