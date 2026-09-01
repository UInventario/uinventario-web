import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, test } from 'node:test';
import { inspectWebV2Performance } from './verify-web-v2-performance.mjs';

const workspaces = [];

async function copyWorkspace() {
  const workspace = await mkdtemp(join(tmpdir(), 'uinventario-performance-'));
  workspaces.push(workspace);
  for (const path of [
    'angular.json',
    'projects/uinventario-web-v2/ngsw-config.json',
    'projects/uinventario-web-v2/src/app/app.routes.ts',
    'projects/uinventario-web-v2/src/app/app.config.ts',
    'projects/uinventario-web-v2/src/app/features/dashboard/ui/dashboard-overview-page/dashboard-overview-page.ts',
    'projects/uinventario-web-v2/src/app/features/catalog/ui/catalog-page/catalog-page.html',
    'projects/uinventario-web-v2/src/app/features/catalog/ui/catalog-page/catalog-page.ts',
    'projects/uinventario-web-v2/src/app/features/inventory/ui/inventory-page/inventory-page.html',
    'projects/uinventario-web-v2/src/app/features/inventory/ui/inventory-page/inventory-page.ts',
  ]) {
    const target = join(workspace, path);
    await mkdir(dirname(target), { recursive: true });
    await cp(resolve(path), target);
  }
  return workspace;
}

async function replace(workspace, path, before, after) {
  const target = join(workspace, path);
  const content = await readFile(target, 'utf8');
  await writeFile(target, content.replace(before, after));
}

async function mutateJson(workspace, path, mutate) {
  const target = join(workspace, path);
  const value = JSON.parse(await readFile(target, 'utf8'));
  mutate(value);
  await writeFile(target, JSON.stringify(value, null, 2));
}

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((workspace) => rm(workspace, { recursive: true })));
});

test('accepts bounded lazy routes, cache and paginated lists', async () => {
  const result = await inspectWebV2Performance({ workspaceRoot: process.cwd() });
  assert.deepEqual(result.violations, []);
  assert.equal(result.workspaceCount, 7);
});

test('rejects an oversized initial bundle and eager JavaScript cache', async () => {
  const workspaceRoot = await copyWorkspace();
  await replace(
    workspaceRoot,
    'angular.json',
    '"maximumError": "600kB"',
    '"maximumError": "750kB"',
  );
  await mutateJson(workspaceRoot, 'projects/uinventario-web-v2/ngsw-config.json', (config) => {
    config.assetGroups.find((group) => group.name === 'uinventario-v2-route-chunks').installMode =
      'prefetch';
  });

  const result = await inspectWebV2Performance({ workspaceRoot });
  assert.match(result.violations.join('\n'), /bundle inicial/);
  assert.match(result.violations.join('\n'), /Service Worker/);
});

test('rejects global preloading and unbounded primary lists', async () => {
  const workspaceRoot = await copyWorkspace();
  await replace(
    workspaceRoot,
    'projects/uinventario-web-v2/src/app/app.config.ts',
    'provideRouter(routes)',
    'provideRouter(routes, withPreloading(PreloadAllModules))',
  );
  await replace(
    workspaceRoot,
    'projects/uinventario-web-v2/src/app/features/catalog/ui/catalog-page/catalog-page.ts',
    'pageSize: 20',
    'pageSize: 2000',
  );

  const result = await inspectWebV2Performance({ workspaceRoot });
  assert.match(result.violations.join('\n'), /precargarse globalmente/);
  assert.match(result.violations.join('\n'), /catálogo debe paginar/);
});
