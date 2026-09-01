import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { OperationLineInput, ProductOption } from '../../domain/operations.models';

const QUANTITY_PATTERN = /^(?:[1-9]\d*(?:\.\d{1,3})?|0\.(?:00[1-9]|0[1-9]\d?|[1-9]\d{0,2}))$/;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'ui-operation-lines-editor',
  styleUrl: './operation-lines-editor.scss',
  templateUrl: './operation-lines-editor.html',
})
export class OperationLinesEditor {
  readonly products = input.required<readonly ProductOption[]>();
  readonly lines = model.required<readonly OperationLineInput[]>();
  readonly valid = computed(() => {
    const lines = this.lines();
    const products = lines.map(({ productId }) => productId);
    return (
      lines.length > 0 &&
      products.every(Boolean) &&
      new Set(products).size === products.length &&
      lines.every(({ quantity }) => QUANTITY_PATTERN.test(quantity))
    );
  });

  protected add(): void {
    if (this.lines().length < 100)
      this.lines.set([...this.lines(), { productId: '', quantity: '1' }]);
  }

  protected remove(index: number): void {
    if (this.lines().length <= 1) return;
    this.lines.set(this.lines().filter((_, candidate) => candidate !== index));
  }

  protected product(index: number, value: string): void {
    this.replace(index, { ...this.lines()[index], productId: value });
  }

  protected quantity(index: number, value: string): void {
    this.replace(index, { ...this.lines()[index], quantity: value });
  }

  protected option(id: string): ProductOption | undefined {
    return this.products().find((product) => product.id === id);
  }

  private replace(index: number, line: OperationLineInput): void {
    this.lines.set(
      this.lines().map((candidate, position) => (position === index ? line : candidate)),
    );
  }
}
