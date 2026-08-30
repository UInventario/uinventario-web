import { Injectable, inject } from '@angular/core';
import { CatalogGateway } from '../domain/catalog.gateway';
import { ClassificationKind, ProductInput, ProductQuery } from '../domain/catalog.models';

@Injectable()
export class CatalogFacade {
  private readonly gateway = inject(CatalogGateway);

  listProducts(query: ProductQuery) {
    return this.gateway.listProducts({
      ...query,
      q: query.q?.trim() || undefined,
      categoryId: query.categoryId || undefined,
      brandId: query.brandId || undefined,
    });
  }

  getOptions() {
    return this.gateway.getOptions();
  }

  saveProduct(input: ProductInput, current?: { readonly id: string; readonly version: number }) {
    const normalized = this.normalizeProduct(input);
    return current
      ? this.gateway.updateProduct(current.id, normalized, current.version)
      : this.gateway.createProduct(normalized);
  }

  retireProduct(id: string) {
    return this.gateway.retireProduct(id);
  }

  listClassifications(kind: ClassificationKind, includeInactive = true) {
    return this.gateway.listClassifications(kind, includeInactive);
  }

  createClassification(kind: ClassificationKind, name: string) {
    return this.gateway.createClassification(kind, name.trim());
  }

  updateClassification(kind: ClassificationKind, id: string, name: string) {
    return this.gateway.updateClassification(kind, id, { name: name.trim() });
  }

  reactivateClassification(kind: ClassificationKind, id: string) {
    return this.gateway.updateClassification(kind, id, { active: true });
  }

  retireClassification(kind: ClassificationKind, id: string, replacementId?: string) {
    return this.gateway.retireClassification(kind, id, replacementId || undefined);
  }

  previewImport(file: File) {
    return this.gateway.previewImport(file);
  }

  confirmImport(id: string, idempotencyKey: string) {
    return this.gateway.confirmImport(id, idempotencyKey);
  }

  downloadImportResult(id: string) {
    return this.gateway.downloadImportResult(id);
  }

  private normalizeProduct(input: ProductInput): ProductInput {
    return {
      ...input,
      name: input.name.trim(),
      sku: input.withoutCode ? undefined : input.sku?.trim().toUpperCase(),
      barcode: input.barcode?.trim() || undefined,
      categoryName: input.categoryName?.trim() || undefined,
      brandName: input.brandName?.trim() || undefined,
      cost: input.cost.trim(),
      price: input.price.trim(),
      minimumQuantity: input.minimumQuantity.trim(),
    };
  }
}
