import { readFile, readdir } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_LINES = 500;
const FORBIDDEN_FIXTURE_IMPORT = /(?:^|[/\\.-])(?:demo|seed|mock-data|fixture-data)(?:[/\\.-]|$)/i;
const FOCUSED_TEST = /\b(?:describe|it|test)\.(?:only|skip)\s*\(/;

export const DEFAULT_TEST_REQUIREMENTS = [
  { name: 'auth', pattern: /app[/\\](?:core[/\\]session|features[/\\]identity)/ },
  { name: 'tenant', pattern: /app[/\\]core[/\\]operational-context/ },
  { name: 'stock', pattern: /app[/\\]features[/\\]inventory/ },
  { name: 'money', pattern: /app[/\\]features[/\\]sales[/\\](?:pos|cash)/ },
  { name: 'contracts', pattern: /app[/\\](?:core[/\\]api|features[/\\].+[/\\]data)/ },
  { name: 'components', pattern: /app[/\\](?:features[/\\].+[/\\]ui|shared[/\\]ui|shell)/ },
];

async function collectSpecs(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  const specs = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) specs.push(...(await collectSpecs(path)));
    else if (entry.isFile() && entry.name.endsWith('.spec.ts')) specs.push(path);
  }
  return specs;
}

function physicalLineCount(content) {
  if (!content) return 0;
  const lines = content.split(/\r\n|\r|\n/).length;
  return /(?:\r\n|\r|\n)$/.test(content) ? lines - 1 : lines;
}

function normalized(path) {
  return path.split(sep).join('/');
}

function importedSpecifiers(content) {
  return [...content.matchAll(/(?:from\s+|import\s*(?:\(\s*)?)(['"])([^'"]+)\1/g)].map(
    (match) => match[2],
  );
}

export async function inspectWebV2TestStrategy({
  workspaceRoot = process.cwd(),
  requirements = DEFAULT_TEST_REQUIREMENTS,
} = {}) {
  const sourceRoot = resolve(workspaceRoot, 'projects', 'uinventario-web-v2', 'src');
  const specs = await collectSpecs(sourceRoot);
  const violations = [];
  const covered = new Set();
  let testCases = 0;

  for (const file of specs) {
    const content = await readFile(file, 'utf8');
    const displayPath = normalized(relative(workspaceRoot, file));
    const lines = physicalLineCount(content);
    if (lines > MAX_LINES) violations.push(`${displayPath}: ${lines} líneas; máximo ${MAX_LINES}`);
    if (FOCUSED_TEST.test(content)) {
      violations.push(`${displayPath}: no se permiten pruebas .only o .skip`);
    }
    testCases += [...content.matchAll(/\b(?:it|test)\s*\(/g)].length;
    for (const specifier of importedSpecifiers(content)) {
      if (FORBIDDEN_FIXTURE_IMPORT.test(specifier)) {
        violations.push(`${displayPath}: depende de datos demo/seed: '${specifier}'`);
      }
      if (!specifier.startsWith('.')) continue;
      const target = resolve(file, '..', specifier);
      const relativeTarget = relative(sourceRoot, target);
      if (relativeTarget === '..' || relativeTarget.startsWith(`..${sep}`)) {
        violations.push(`${displayPath}: importa código fuera de Web V2: '${specifier}'`);
      }
    }
    for (const requirement of requirements) {
      if (requirement.pattern.test(displayPath)) covered.add(requirement.name);
    }
  }

  for (const requirement of requirements) {
    if (!covered.has(requirement.name)) {
      violations.push(`falta cobertura estructural para el riesgo '${requirement.name}'`);
    }
  }
  if (!specs.length || !testCases) violations.push('Web V2 debe contener pruebas ejecutables');
  return { specFiles: specs.length, testCases, covered: [...covered].sort(), violations };
}

export async function verifyWebV2TestStrategy(options) {
  const result = await inspectWebV2TestStrategy(options);
  if (result.violations.length) {
    throw new Error(`Estrategia de pruebas Web V2 inválida:\n- ${result.violations.join('\n- ')}`);
  }
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await verifyWebV2TestStrategy();
    console.log(
      `Estrategia Web V2 verificada: ${result.specFiles} archivos, ${result.testCases} casos, riesgos ${result.covered.join(', ')}.`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
