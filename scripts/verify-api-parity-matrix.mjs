import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DOMAIN_FILES } from './api-parity-config.mjs';

const root = resolve(process.argv[2] ?? 'docs/web-v2/api-parity/data');
const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
const records = [];

if (!/^[0-9a-f]{40}$/.test(manifest.sourceCommit ?? '')) {
  throw new Error('Manifest has no valid source commit');
}

for (const fileName of Object.values(DOMAIN_FILES)) {
  const content = await readFile(join(root, fileName), 'utf8');
  const lines = content.trim().split('\n').filter(Boolean);
  if (lines.length > 500) throw new Error(`${fileName} exceeds 500 lines`);
  records.push(
    ...lines.map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${fileName}:${index + 1}: ${error.message}`, { cause: error });
      }
    }),
  );
}

const required = [
  'controller',
  'operation',
  'method',
  'path',
  'capability',
  'domain',
  'uiDisposition',
  'uiReason',
  'screen',
  'permissions',
  'guards',
  'states',
  'errors',
  'test',
  'source',
];
const identities = new Set();
for (const record of records) {
  for (const field of required) {
    if (record[field] === undefined || record[field] === '') {
      throw new Error(
        `${record.controller ?? 'unknown'}#${record.operation ?? 'unknown'} misses ${field}`,
      );
    }
  }
  const identity = `${record.controller}:${record.operation}:${record.method}:${record.path}`;
  if (identities.has(identity)) throw new Error(`Duplicate matrix entry: ${identity}`);
  identities.add(identity);
  if (!Array.isArray(record.permissions) || record.permissions.length === 0) {
    throw new Error(`${identity} has no permission/guard classification`);
  }
  if (!Array.isArray(record.guards) || record.guards.length === 0) {
    throw new Error(`${identity} has no guard classification`);
  }
  if (!Array.isArray(record.states) || record.states.length === 0) {
    throw new Error(`${identity} has no UI state model`);
  }
  if (!Array.isArray(record.errors) || record.errors.length === 0) {
    throw new Error(`${identity} has no error model`);
  }
  const noWebUi = record.uiDisposition === 'explicit-no-web-ui';
  if (noWebUi && record.uiRoute !== null) {
    throw new Error(`${identity} excludes Web UI but still declares a route`);
  }
  if (!noWebUi && !record.uiRoute?.startsWith('/')) {
    throw new Error(`${identity} has no routed Web workspace`);
  }
}

const controllers = [...new Set(records.map(({ controller }) => controller))].sort();
if (controllers.length !== 50 || manifest.controllerCount !== 50) {
  throw new Error(`Expected 50 controllers, found ${controllers.length}`);
}
if (records.length !== manifest.endpointCount) {
  throw new Error(`Expected ${manifest.endpointCount} endpoints, found ${records.length}`);
}
if (JSON.stringify(controllers) !== JSON.stringify(manifest.controllerNames)) {
  throw new Error('Controller names differ from the versioned manifest');
}
const digest = createHash('sha256')
  .update(
    records
      .map(({ method, path, controller, permissions }) =>
        JSON.stringify({ controller, method, path, permissions }),
      )
      .join('\n'),
  )
  .digest('hex');
if (digest !== manifest.contractDigest) throw new Error('Contract digest differs from manifest');

console.log(
  `Parity matrix verified: ${controllers.length} controllers, ${records.length} endpoints.`,
);
