import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { OperationalStateKind } from '../../shared/ui/operational-state/operational-state.models';
import { OperationalState } from '../../shared/ui/operational-state/operational-state';
import { RibbonTab } from '../../shared/ui/ribbon/ribbon.models';
import { Ribbon } from '../../shared/ui/ribbon/ribbon';

interface StateOption {
  readonly kind: OperationalStateKind;
  readonly label: string;
  readonly icon: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OperationalState, Ribbon, TagModule],
  selector: 'ui-visual-system-page',
  styleUrl: './visual-system-page.scss',
  templateUrl: './visual-system-page.html',
})
export class VisualSystemPage {
  protected readonly activeRibbonTab = signal('catalog');
  protected readonly lastCommand = signal('Selecciona un comando para verificar la interacción.');
  protected readonly selectedState = signal<OperationalStateKind>('empty');

  protected readonly ribbonTabs: readonly RibbonTab[] = [
    {
      id: 'catalog',
      label: 'Catálogo',
      groups: [
        {
          id: 'records',
          label: 'Registros',
          commands: [
            { id: 'new-product', label: 'Nuevo', icon: 'pi pi-plus', shortcut: 'Ctrl+N' },
            { id: 'edit-product', label: 'Editar', icon: 'pi pi-pencil', shortcut: 'Ctrl+E' },
            { id: 'search', label: 'Buscar', icon: 'pi pi-search', shortcut: '/' },
          ],
        },
        {
          id: 'exchange',
          label: 'Datos',
          commands: [
            { id: 'import', label: 'Importar', icon: 'pi pi-upload' },
            { id: 'export', label: 'Exportar', icon: 'pi pi-download' },
          ],
        },
      ],
    },
    {
      id: 'inventory',
      label: 'Inventario',
      groups: [
        {
          id: 'movement',
          label: 'Movimientos',
          commands: [
            { id: 'stock-entry', label: 'Entrada', icon: 'pi pi-arrow-down-left' },
            { id: 'stock-adjustment', label: 'Ajuste', icon: 'pi pi-sliders-h' },
            { id: 'stock-count', label: 'Conteo', icon: 'pi pi-list-check' },
          ],
        },
      ],
    },
    {
      id: 'sales',
      label: 'Ventas',
      groups: [
        {
          id: 'checkout',
          label: 'Operación',
          commands: [
            { id: 'new-sale', label: 'Nueva venta', icon: 'pi pi-shopping-cart', shortcut: 'F2' },
            { id: 'suspend-sale', label: 'Suspender', icon: 'pi pi-pause', disabled: true },
          ],
        },
      ],
    },
  ];

  protected readonly stateOptions: readonly StateOption[] = [
    { kind: 'loading', label: 'Loading', icon: 'pi pi-spinner' },
    { kind: 'empty', label: 'Empty', icon: 'pi pi-inbox' },
    { kind: 'error', label: 'Error', icon: 'pi pi-exclamation-circle' },
    { kind: 'offline', label: 'Offline', icon: 'pi pi-cloud-off' },
    { kind: 'forbidden', label: 'Sin permisos', icon: 'pi pi-lock' },
  ];

  protected invokeCommand(commandId: string): void {
    this.lastCommand.set(`Comando invocado: ${commandId}`);
  }
}
