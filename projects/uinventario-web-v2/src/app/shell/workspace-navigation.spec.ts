import { ribbonForWorkspace, WORKSPACE_NAVIGATION, workspaceFromUrl } from './workspace-navigation';

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
});
