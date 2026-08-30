import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, Input, OnChanges, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ProductData } from '../catalog/product-api.service';
import {
  InventoryApiService,
  InventoryKitOperationData,
  InventoryLocationData,
} from './inventory-api.service';

@Component({
  selector: 'app-inventory-kit-panel',
  imports: [FormsModule],
  templateUrl: './inventory-kit-panel.component.html',
  styleUrl: './inventory-kit-panel.component.scss',
})
export class InventoryKitPanelComponent implements OnChanges {
  private readonly inventory = inject(InventoryApiService);

  @Input({ required: true }) product!: ProductData;
  @Input({ required: true }) locations: InventoryLocationData[] = [];
  @Output() completed = new EventEmitter<InventoryKitOperationData>();

  protected operationType: InventoryKitOperationData['operationType'] = 'ASSEMBLE';
  protected locationId = '';
  protected quantity = '1';
  protected saving = false;
  protected error: string | null = null;
  protected success: string | null = null;

  ngOnChanges(): void {
    if (!this.locations.some(({ id }) => id === this.locationId)) {
      this.locationId = this.locations[0]?.id ?? '';
    }
  }

  protected submit(): void {
    if (this.saving) return;
    this.error = null;
    this.success = null;
    if (!this.locationId || !/^[1-9]\d{0,11}$/.test(this.quantity.trim())) {
      this.error = 'Selecciona una ubicación y escribe una cantidad entera mayor que cero.';
      return;
    }
    this.saving = true;
    this.inventory
      .operateKit(
        this.product.id,
        {
          operationType: this.operationType,
          locationId: this.locationId,
          quantity: this.quantity.trim(),
        },
        crypto.randomUUID(),
      )
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: ({ data }) => {
          this.completed.emit(data);
          this.success = `${data.operationType === 'ASSEMBLE' ? 'Ensamblado' : 'Desensamblado'} registrado: ${data.quantity} kit(s).`;
        },
        error: (response: HttpErrorResponse) => {
          this.error =
            typeof response.error?.message === 'string'
              ? response.error.message
              : 'No fue posible registrar la operación del kit.';
        },
      });
  }
}
