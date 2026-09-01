import { Observable } from 'rxjs';
import {
  CatalogOptions,
  Classification,
  ClassificationKind,
  Product,
  ProductImport,
  ProductInput,
  ProductPage,
  ProductQuery,
  UpdateProductKitInput,
  UpdateProductVariantsInput,
} from './catalog.models';

export abstract class CatalogGateway {
  abstract listProducts(query: ProductQuery): Observable<ProductPage>;
  abstract getProduct(id: string): Observable<Product>;
  abstract getOptions(): Observable<CatalogOptions>;
  abstract createProduct(input: ProductInput): Observable<Product>;
  abstract updateProduct(id: string, input: ProductInput, version: number): Observable<Product>;
  abstract updateProductVariants(
    id: string,
    input: UpdateProductVariantsInput,
  ): Observable<Product>;
  abstract updateProductKit(id: string, input: UpdateProductKitInput): Observable<Product>;
  abstract retireProduct(id: string): Observable<'DELETED' | 'DEACTIVATED'>;
  abstract listClassifications(
    kind: ClassificationKind,
    includeInactive: boolean,
  ): Observable<readonly Classification[]>;
  abstract createClassification(kind: ClassificationKind, name: string): Observable<Classification>;
  abstract updateClassification(
    kind: ClassificationKind,
    id: string,
    input: { readonly name?: string; readonly active?: boolean },
  ): Observable<Classification>;
  abstract retireClassification(
    kind: ClassificationKind,
    id: string,
    replacementId?: string,
  ): Observable<number>;
  abstract previewImport(file: File): Observable<ProductImport>;
  abstract confirmImport(id: string, idempotencyKey: string): Observable<ProductImport>;
  abstract downloadImportResult(id: string): Observable<Blob>;
}
