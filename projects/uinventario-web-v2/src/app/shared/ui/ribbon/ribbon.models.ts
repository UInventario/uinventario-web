export interface RibbonCommand {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly shortcut?: string;
  readonly disabled?: boolean;
}

export interface RibbonGroup {
  readonly id: string;
  readonly label: string;
  readonly commands: readonly RibbonCommand[];
}

export interface RibbonTab {
  readonly id: string;
  readonly label: string;
  readonly groups: readonly RibbonGroup[];
}
