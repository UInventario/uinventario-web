export type OperationalStateKind = 'loading' | 'empty' | 'error' | 'offline' | 'forbidden';

export interface OperationalStatePresentation {
  readonly icon: string;
  readonly title: string;
  readonly message: string;
}
