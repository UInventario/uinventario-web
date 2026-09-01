import {
  ribbonForWorkspace,
  WORKSPACE_NAVIGATION,
  workspaceAllowed,
  workspaceFromUrl,
} from './workspace-navigation';

describe('workspace navigation', () => {
  it('resolves a workspace from a clean URL without relying on a hash', () => {
    expect(workspaceFromUrl('/ventas?caja=principal').id).toBe('ventas');
    expect(workspaceFromUrl('/inventario#stock').id).toBe('inventario');
  });

  it('falls back to dashboard for unknown routes', () => {
    expect(workspaceFromUrl('/ruta-desconocida').id).toBe('dashboard');
  });

  it('provides contextual Ribbon commands for every workspace', () => {
    for (const workspace of WORKSPACE_NAVIGATION) {
      const tabs = ribbonForWorkspace(workspace);
      expect(tabs[0].id).toBe(workspace.id);
      expect(tabs[0].groups.flatMap((group) => group.commands).length).toBeGreaterThan(0);
    }
  });

  it('applies the same permission policy to navigation and commands', () => {
    const permissions = new Set(['INVENTORY_VIEW'] as const);
    const inventory = WORKSPACE_NAVIGATION.find(({ id }) => id === 'inventario')!;
    const sales = WORKSPACE_NAVIGATION.find(({ id }) => id === 'ventas')!;

    expect(workspaceAllowed(inventory, permissions)).toBe(true);
    expect(workspaceAllowed(sales, permissions)).toBe(false);
    const commands = ribbonForWorkspace(inventory, permissions)[0].groups.flatMap(
      (group) => group.commands,
    );
    expect(commands.find(({ id }) => id === 'stock-entry')?.disabled).toBe(true);
  });

  it('lets audit-only roles enter reports without exposing unrelated commands', () => {
    const permissions = new Set(['AUDIT_VIEW'] as const);
    const reports = WORKSPACE_NAVIGATION.find(({ id }) => id === 'reportes')!;

    expect(workspaceAllowed(reports, permissions)).toBe(true);
    const commands = ribbonForWorkspace(reports, permissions)[0].groups.flatMap(
      (group) => group.commands,
    );
    expect(commands.find(({ id }) => id === 'run-report')?.disabled).toBe(false);
    expect(commands.find(({ id }) => id === 'export-report')?.disabled).toBe(true);
  });
});
