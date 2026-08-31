import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, test } from 'node:test';
import { inspectWebV2TestStrategy } from './verify-web-v2-test-strategy.mjs';

const workspaces = [];
const requirement = [{ name: 'critical', pattern: /critical/ }];

async function createWorkspace(files) {
  const workspace = await mkdtemp(join(tmpdir(), 'uinventario-tests-'));
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

test('accepts isolated tests that cover the declared risk', async () => {
  const workspaceRoot = await createWorkspace({
    'projects/uinventario-web-v2/src/app/critical/service.spec.ts':
      "import { value } from './service';\ntest('contract', () => expect(value).toBe(1));",
  });
  const result = await inspectWebV2TestStrategy({ workspaceRoot, requirements: requirement });
  assert.deepEqual(result.violations, []);
  assert.equal(result.testCases, 1);
});

test('rejects missing risks, focused tests and oversized specs', async () => {
  const workspaceRoot = await createWorkspace({
    'projects/uinventario-web-v2/src/app/other/service.spec.ts': [
      "test.only('focused', () => {});",
      ...Array.from({ length: 500 }, () => '// line'),
    ].join('\n'),
  });
  const result = await inspectWebV2TestStrategy({ workspaceRoot, requirements: requirement });
  const violations = result.violations.join('\n');
  assert.match(violations, /501 líneas; máximo 500/);
  assert.match(violations, /\.only o \.skip/);
  assert.match(violations, /falta cobertura estructural/);
});

test('rejects imports from legacy or demo fixture sources', async () => {
  const workspaceRoot = await createWorkspace({
    'projects/uinventario-web-v2/src/app/critical/service.spec.ts':
      "import '../demo/seed';\nimport '../../../../../src/app/legacy';\ntest('contract', () => {});",
  });
  const result = await inspectWebV2TestStrategy({ workspaceRoot, requirements: requirement });
  const violations = result.violations.join('\n');
  assert.match(violations, /datos demo\/seed/);
  assert.match(violations, /fuera de Web V2/);
});
