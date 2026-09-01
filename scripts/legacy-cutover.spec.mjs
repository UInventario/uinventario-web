import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const migrationSource = await readFile(
  new URL('../public/legacy-cutover.js', import.meta.url),
  'utf8',
);

function migrationTarget(pathname, search = '') {
  let target;
  vm.runInNewContext(migrationSource, {
    location: {
      pathname,
      search,
      replace(value) {
        target = value;
      },
    },
    Map,
  });
  return target;
}

test('moves cached legacy routes to their Angular equivalents', () => {
  assert.equal(migrationTarget('/'), '/v2/');
  assert.equal(migrationTarget('/login', '?returnUrl=%2Fapp'), '/v2/login?returnUrl=%2Fapp');
  assert.equal(migrationTarget('/registro/'), '/v2/registro');
  assert.equal(migrationTarget('/recuperar'), '/v2/recuperar');
  assert.equal(migrationTarget('/restablecer', '?token=test'), '/v2/restablecer?token=test');
  assert.equal(migrationTarget('/onboarding'), '/v2/onboarding');
  assert.equal(migrationTarget('/app/inventory-activity'), '/v2/dashboard/resumen');
  assert.equal(migrationTarget('/unknown'), '/v2/');
});
