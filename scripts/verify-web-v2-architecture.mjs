import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const MAX_LINES = 500;
const TEAM_FILE_EXTENSIONS = new Set(['.css', '.html', '.mjs', '.scss', '.ts']);
const FEATURE_LAYERS = new Set(['application', 'data', 'domain', 'ui']);
const DOMAIN_FORBIDDEN_PACKAGES = ['@angular/', '@primeuix/', 'primeng/', 'tailwindcss'];

async function collectFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function physicalLineCount(content) {
  if (!content) return 0;
  const lines = content.split(/\r\n|\r|\n/).length;
  return /(?:\r\n|\r|\n)$/.test(content) ? lines - 1 : lines;
}

function normalizePath(path) {
  return path.split(sep).join('/');
}

function classifySourcePath(path) {
  const parts = normalizePath(path).split('/');
  if (parts[0] !== 'app') return { area: 'root', parts };
  if (parts[1] !== 'features') return { area: parts[1] ?? 'root', parts };

  const domain = parts[2];
  const layer = parts[3];
  return {
    area: 'features',
    domain,
    layer: FEATURE_LAYERS.has(layer) ? layer : undefined,
    parts,
  };
}

function collectModuleReferences(sourceFile) {
  const references = [];
  const addReference = (literal) => {
    if (!literal || !ts.isStringLiteralLike(literal)) return;
    const position = sourceFile.getLineAndCharacterOfPosition(literal.getStart(sourceFile));
    references.push({ specifier: literal.text, line: position.line + 1 });
  };

  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      addReference(node.moduleSpecifier);
    } else if (
      ts.isCallExpression(node) &&
      node.arguments.length === 1 &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
      addReference(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return references;
}

function resolveInternalTarget(specifier, originFile, sourceRoot) {
  if (specifier.startsWith('.')) {
    const target = resolve(dirname(originFile), specifier);
    const relativeTarget = relative(sourceRoot, target);
    if (
      relativeTarget === '..' ||
      relativeTarget.startsWith(`..${sep}`) ||
      isAbsolute(relativeTarget)
    ) {
      return undefined;
    }
    return normalizePath(relativeTarget);
  }
  if (specifier.startsWith('@app/')) return specifier.slice('@app/'.length);
  return undefined;
}

function isFeaturePublicEntry(target) {
  if (target.area !== 'features' || target.layer) return false;
  const file = target.parts[3] ?? '';
  return file === `${target.domain}.routes` || file === `${target.domain}.routes.ts`;
}

function validateDependency(origin, target, specifier) {
  if (
    origin.area === 'features' &&
    target?.area === 'features' &&
    origin.domain !== target.domain
  ) {
    return `feature '${origin.domain}' no puede importar feature '${target.domain}'`;
  }
  if (origin.area !== 'features' && target?.area === 'features' && !isFeaturePublicEntry(target)) {
    return `código externo sólo puede importar la entrada pública de feature '${target.domain}'`;
  }
  if (origin.area === 'shared' && target && target.area !== 'shared') {
    return `shared no puede depender de '${target.area}'`;
  }
  if (origin.area === 'core' && target && ['features', 'shell'].includes(target.area)) {
    return `core no puede depender de '${target.area}'`;
  }
  if (origin.area !== 'features' || !origin.layer) return undefined;

  if (
    origin.layer === 'domain' &&
    DOMAIN_FORBIDDEN_PACKAGES.some((prefix) => specifier.startsWith(prefix))
  ) {
    return `domain debe ser independiente de '${specifier}'`;
  }
  if (!target) return undefined;
  if (origin.layer === 'domain' && (target.area !== 'features' || target.layer !== 'domain')) {
    return 'domain sólo puede importar su propio domain';
  }
  if (target.area !== 'features' || target.domain !== origin.domain || !target.layer)
    return undefined;

  const forbiddenLayers = {
    application: new Set(['data', 'ui']),
    data: new Set(['application', 'ui']),
    domain: new Set(['application', 'data', 'ui']),
    ui: new Set(['data']),
  };
  if (forbiddenLayers[origin.layer].has(target.layer)) {
    return `${origin.layer} no puede depender de ${target.layer}`;
  }
  return undefined;
}

export async function inspectWebV2Architecture({ workspaceRoot = process.cwd() } = {}) {
  const sourceRoot = resolve(workspaceRoot, 'projects', 'uinventario-web-v2', 'src');
  const scanRoots = [
    sourceRoot,
    resolve(workspaceRoot, 'e2e-v2'),
    resolve(workspaceRoot, 'scripts'),
  ];
  const scannedFiles = (await Promise.all(scanRoots.map(collectFiles))).flat();
  const teamFiles = scannedFiles.filter((file) => TEAM_FILE_EXTENSIONS.has(extname(file)));
  const violations = [];

  for (const file of teamFiles) {
    const content = await readFile(file, 'utf8');
    const displayPath = normalizePath(relative(workspaceRoot, file));
    const lines = physicalLineCount(content);
    if (lines > MAX_LINES) violations.push(`${displayPath}: ${lines} líneas; máximo ${MAX_LINES}`);

    if (extname(file) !== '.ts' || !file.startsWith(`${sourceRoot}${sep}`)) continue;
    const sourcePath = normalizePath(relative(sourceRoot, file));
    const origin = classifySourcePath(sourcePath);
    const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
    for (const reference of collectModuleReferences(sourceFile)) {
      const targetPath = resolveInternalTarget(reference.specifier, file, sourceRoot);
      const target = targetPath ? classifySourcePath(targetPath) : undefined;
      const violation = validateDependency(origin, target, reference.specifier);
      if (violation) violations.push(`${displayPath}:${reference.line}: ${violation}`);
    }
  }

  return { checkedFiles: teamFiles.length, violations };
}

export async function verifyWebV2Architecture(options) {
  const result = await inspectWebV2Architecture(options);
  if (result.violations.length) {
    throw new Error(`Arquitectura Web V2 inválida:\n- ${result.violations.join('\n- ')}`);
  }
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await verifyWebV2Architecture();
    console.log(
      `Arquitectura Web V2 verificada: ${result.checkedFiles} archivos, límite ${MAX_LINES}.`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
