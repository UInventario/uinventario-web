import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, test } from 'node:test';
import { inspectWebV2Architecture } from './verify-web-v2-architecture.mjs';

const workspaces = [];

async function createWorkspace(files) {
  const workspace = await mkdtemp(join(tmpdir(), 'uinventario-architecture-'));
  workspaces.push(workspace);
  for (const [path, content] of Object.entries(files)) {
    const target = join(workspace, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  return workspace;
}

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((workspace) => rm(workspace, { recursive: true })));
});

test('accepts dependencies that point inward inside one feature', async () => {
  const workspaceRoot = await createWorkspace({
    'projects/uinventario-web-v2/src/app/features/catalog/domain/product.ts':
      'export interface Product { id: string; }',
    'projects/uinventario-web-v2/src/app/features/catalog/application/list-products.ts':
      "import type { Product } from '../domain/product';\nexport type ProductList = Product[];",
    'projects/uinventario-web-v2/src/app/features/catalog/ui/product-list.ts':
      "import type { ProductList } from '../application/list-products';\nexport const rows: ProductList = [];",
  });

  const result = await inspectWebV2Architecture({ workspaceRoot });
  assert.deepEqual(result.violations, []);
});

test('rejects files over 500 lines without an allowlist', async () => {
  const workspaceRoot = await createWorkspace({
    'projects/uinventario-web-v2/src/app/shared/oversized.ts': Array.from(
      { length: 501 },
      (_, index) => `export const line${index} = ${index};`,
    ).join('\n'),
  });

  const result = await inspectWebV2Architecture({ workspaceRoot });
  assert.match(result.violations.join('\n'), /501 líneas; máximo 500/);
});

test('rejects cross-feature and outward layer imports', async () => {
  const workspaceRoot = await createWorkspace({
    'projects/uinventario-web-v2/src/app/features/catalog/ui/catalog-page.ts':
      "import '../data/catalog-api';\nimport '../../sales/domain/sale';",
  });

  const result = await inspectWebV2Architecture({ workspaceRoot });
  const violations = result.violations.join('\n');
  assert.match(violations, /ui no puede depender de data/);
  assert.match(violations, /feature 'catalog' no puede importar feature 'sales'/);
});

test('keeps domain independent from UI frameworks', async () => {
  const workspaceRoot = await createWorkspace({
    'projects/uinventario-web-v2/src/app/features/catalog/domain/product.ts':
      "import { signal } from '@angular/core';\nexport const product = signal(null);",
  });

  const result = await inspectWebV2Architecture({ workspaceRoot });
  assert.match(result.violations.join('\n'), /domain debe ser independiente de '@angular\/core'/);
});

test('allows shell composition only through a feature public route entry', async () => {
  const workspaceRoot = await createWorkspace({
    'projects/uinventario-web-v2/src/app/shell/app.routes.ts':
      "import '../features/catalog/catalog.routes';\nimport '../features/sales/ui/sales-page';",
  });

  const result = await inspectWebV2Architecture({ workspaceRoot });
  assert.equal(result.violations.length, 1);
  assert.match(result.violations[0], /entrada pública de feature 'sales'/);
});
