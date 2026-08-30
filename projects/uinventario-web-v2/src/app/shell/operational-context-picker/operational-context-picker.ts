import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { OperationalContextStore } from '../../core/operational-context/operational-context.store';
import { SessionState } from '../../core/session/session-state';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule],
  selector: 'ui-operational-context-picker',
  styleUrl: './operational-context-picker.scss',
  templateUrl: './operational-context-picker.html',
})
export class OperationalContextPicker implements OnInit {
  private readonly sessions = inject(SessionState);
  protected readonly contexts = inject(OperationalContextStore);
  protected readonly open = signal(false);
  protected readonly branchId = signal('');
  protected readonly warehouseId = signal('');
  protected readonly cashRegisterId = signal('');
  protected readonly session = this.sessions.session;
  protected readonly selectedBranch = computed(() =>
    this.contexts.branches().find((branch) => branch.id === this.branchId()),
  );
  protected readonly warehouses = computed(() =>
    (this.selectedBranch()?.warehouses ?? []).filter((warehouse) => warehouse.active),
  );
  protected readonly cashRegisters = computed(() => this.selectedBranch()?.cashRegisters ?? []);
  protected readonly canApply = computed(
    () => Boolean(this.branchId() && this.warehouseId()) && !this.contexts.switching(),
  );

  ngOnInit(): void {
    this.syncFromSession();
    this.contexts.load().subscribe({ error: () => undefined });
  }

  protected toggle(): void {
    if (!this.open()) this.syncFromSession();
    this.open.update((current) => !current);
  }

  protected close(): void {
    this.open.set(false);
    this.syncFromSession();
  }

  protected selectBranch(event: Event): void {
    const id = this.valueFrom(event);
    this.branchId.set(id);
    const branch = this.contexts.branches().find((candidate) => candidate.id === id);
    const current = this.session()?.context;
    const currentWarehouse = branch?.warehouses.find(
      (warehouse) => warehouse.active && warehouse.id === current?.warehouse?.id,
    );
    const currentRegister = branch?.cashRegisters.find(
      (register) => register.id === current?.cashRegister?.id,
    );
    this.warehouseId.set(
      currentWarehouse?.id ?? branch?.warehouses.find((warehouse) => warehouse.active)?.id ?? '',
    );
    this.cashRegisterId.set(currentRegister?.id ?? branch?.cashRegisters[0]?.id ?? '');
  }

  protected selectWarehouse(event: Event): void {
    this.warehouseId.set(this.valueFrom(event));
  }

  protected selectCashRegister(event: Event): void {
    this.cashRegisterId.set(this.valueFrom(event));
  }

  protected retry(): void {
    this.contexts.load(true).subscribe({ error: () => undefined });
  }

  protected apply(): void {
    if (!this.canApply()) return;
    const cashRegisterId = this.cashRegisterId() || undefined;
    this.contexts
      .change({
        branchId: this.branchId(),
        warehouseId: this.warehouseId(),
        ...(cashRegisterId ? { cashRegisterId } : {}),
      })
      .subscribe({ next: () => this.open.set(false), error: () => undefined });
  }

  private syncFromSession(): void {
    const context = this.session()?.context;
    this.branchId.set(context?.branch?.id ?? '');
    this.warehouseId.set(context?.warehouse?.id ?? '');
    this.cashRegisterId.set(context?.cashRegister?.id ?? '');
  }

  private valueFrom(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }
}
