import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import {
  InventoryActivityMovement,
  InventoryActivityReportData,
  InventoryActivityReportItem,
  InventoryActivityReportQuery,
  InventoryActivityReportApiService,
} from './inventory-activity-report-api.service';
import type { InventoryMovementType } from './inventory-api.service';

@Component({
  selector: 'app-inventory-activity-report',
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule, RouterLink],
  templateUrl: './inventory-activity-report.component.html',
  styleUrl: './inventory-activity-report.component.scss',
})
export class InventoryActivityReportComponent implements OnInit {
  private readonly inventory = inject(InventoryActivityReportApiService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly report = signal<InventoryActivityReportData | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly page = signal(1);
  protected readonly totalPages = signal(0);
  protected readonly selected = signal<InventoryActivityReportItem | null>(null);
  protected readonly movements = signal<InventoryActivityMovement[]>([]);
  protected readonly movementPage = signal(1);
  protected readonly movementTotalPages = signal(0);
  protected readonly loadingMovements = signal(false);
  protected readonly movementError = signal<string | null>(null);
  protected filteredWarehouses() {
    const branchId = this.filterForm.controls.branchId.value;
    const warehouses = this.report()?.scope.warehouses ?? [];
    return branchId ? warehouses.filter(({ branch }) => branch.id === branchId) : warehouses;
  }
  protected readonly filterForm = this.formBuilder.nonNullable.group({
    dateFrom: [this.dateOffset(-29), Validators.required],
    dateTo: [this.dateOffset(0), Validators.required],
    branchId: [''],
    warehouseId: [''],
    categoryId: [''],
    product: ['', [Validators.maxLength(80)]],
  });

  ngOnInit(): void {
    this.load(1);
  }

  protected filter(): void {
    if (this.filterForm.invalid) return this.filterForm.markAllAsTouched();
    const { dateFrom, dateTo } = this.filterForm.getRawValue();
    if (dateFrom > dateTo) {
      this.error.set('La fecha inicial no puede ser posterior a la fecha final.');
      return;
    }
    this.selected.set(null);
    this.movements.set([]);
    this.load(1);
  }

  protected branchChanged(): void {
    const selectedWarehouse = this.filterForm.controls.warehouseId.value;
    if (
      selectedWarehouse &&
      !this.filteredWarehouses().some(({ id }) => id === selectedWarehouse)
    ) {
      this.filterForm.controls.warehouseId.setValue('');
    }
  }

  protected previous(): void {
    if (this.page() > 1) this.load(this.page() - 1);
  }

  protected next(): void {
    if (this.page() < this.totalPages()) this.load(this.page() + 1);
  }

  protected showMovements(item: InventoryActivityReportItem): void {
    this.selected.set(item);
    this.loadMovements(1);
  }

  protected previousMovements(): void {
    if (this.movementPage() > 1) this.loadMovements(this.movementPage() - 1);
  }

  protected nextMovements(): void {
    if (this.movementPage() < this.movementTotalPages()) {
      this.loadMovements(this.movementPage() + 1);
    }
  }

  protected movementType(type: InventoryMovementType): string {
    return {
      INITIAL: 'Stock inicial',
      ENTRY: 'Entrada',
      EXIT: 'Salida',
      RETURN: 'Devolución',
      LOSS: 'Pérdida',
      DAMAGE: 'Daño',
      ADJUSTMENT: 'Ajuste',
      IMPORT: 'Importación',
      STATE_TRANSITION: 'Cambio de estado',
      TRANSFER_OUT: 'Transferencia enviada',
      TRANSFER_IN: 'Transferencia recibida',
      TRANSFER_RECEIPT: 'Recepción de transferencia',
      TRANSFER_DISCREPANCY: 'Diferencia de transferencia',
      SALE: 'Venta',
      SALE_VOID: 'Venta anulada',
      SALE_RETURN: 'Devolución de venta',
      PURCHASE_RECEIPT: 'Recepción de compra',
      SUPPLIER_RETURN: 'Devolución a proveedor',
    }[type];
  }

  private load(page: number): void {
    const query = this.query(page);
    this.loading.set(true);
    this.error.set(null);
    this.inventory
      .report(query)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ data, meta }) => {
          this.report.set(data);
          this.page.set(meta.pagination.page);
          this.totalPages.set(meta.pagination.totalPages);
        },
        error: (error: HttpErrorResponse) => this.error.set(this.messageFor(error)),
      });
  }

  private loadMovements(page: number): void {
    const item = this.selected();
    if (!item) return;
    const query = this.query(page);
    this.loadingMovements.set(true);
    this.movementError.set(null);
    this.inventory
      .movements(item.product.id, {
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        branchId: query.branchId,
        warehouseId: query.warehouseId,
        page,
        pageSize: 10,
      })
      .pipe(finalize(() => this.loadingMovements.set(false)))
      .subscribe({
        next: ({ data, meta }) => {
          this.movements.set(data);
          this.movementPage.set(meta.pagination.page);
          this.movementTotalPages.set(meta.pagination.totalPages);
        },
        error: (error: HttpErrorResponse) => this.movementError.set(this.messageFor(error)),
      });
  }

  private query(page: number): InventoryActivityReportQuery {
    const value = this.filterForm.getRawValue();
    return {
      dateFrom: value.dateFrom,
      dateTo: value.dateTo,
      ...(value.branchId ? { branchId: value.branchId } : {}),
      ...(value.warehouseId ? { warehouseId: value.warehouseId } : {}),
      ...(value.categoryId ? { categoryId: value.categoryId } : {}),
      ...(value.product.trim() ? { product: value.product.trim() } : {}),
      page,
      pageSize: 20,
    };
  }

  private dateOffset(days: number): string {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + days);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private messageFor(error: HttpErrorResponse): string {
    if (error.status === 403) return 'No tienes permiso para consultar actividad de inventario.';
    if (error.status === 0) return 'No fue posible conectar con el servicio de inventario.';
    return 'No fue posible cargar el reporte de actividad.';
  }
}
