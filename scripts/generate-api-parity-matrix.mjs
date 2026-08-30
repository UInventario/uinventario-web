import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import ts from 'typescript';
import {
  CONTROLLER_UI,
  DOMAIN_FILES,
  NO_WEB_UI_DOMAINS,
  NO_WEB_UI_OPERATIONS,
  NO_WEB_UI_REASONS,
  OPERATION_UI_OVERRIDES,
} from './api-parity-config.mjs';

const apiRoot = resolve(process.argv[2] ?? '../uinventario-api');
const outputRoot = resolve(process.argv[3] ?? 'docs/web-v2/api-parity/data');
const apiSrc = join(apiRoot, 'src');
const execFileAsync = promisify(execFile);

const walk = async (directory) => {
  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory() ? walk(join(directory, entry.name)) : join(directory, entry.name),
    ),
  );
  return nested.flat().filter((path) => path.endsWith('.controller.ts'));
};

const decoratorName = (decorator) => {
  const expression = decorator.expression;
  if (ts.isCallExpression(expression)) return expression.expression.getText();
  return expression.getText();
};

const decorators = (node) => (ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : []);

const decoratorCall = (node, name) =>
  decorators(node)
    .map((decorator) => decorator.expression)
    .find(
      (expression) => ts.isCallExpression(expression) && expression.expression.getText() === name,
    );

const textArgument = (call, index = 0) => {
  const argument = call?.arguments[index];
  return argument && (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))
    ? argument.text
    : '';
};

const callArguments = (node, name) => {
  const call = decoratorCall(node, name);
  return call ? call.arguments.map((argument) => argument.getText().replaceAll("'", '')) : [];
};

const routePath = (...parts) =>
  `/${parts.filter(Boolean).join('/')}`.replaceAll(/\/+/g, '/').replace(/\/$/, '') || '/';

const humanize = (value) =>
  value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .toLowerCase();

const extractController = async (file) => {
  const sourceText = await readFile(file, 'utf8');
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true);
  const controllerClass = source.statements.find(
    (node) => ts.isClassDeclaration(node) && decoratorCall(node, 'Controller'),
  );
  if (!controllerClass?.name) throw new Error(`Controller class not found: ${file}`);

  const controller = controllerClass.name.text;
  const mapping = CONTROLLER_UI[controller];
  if (!mapping) throw new Error(`UI mapping missing for ${controller}`);
  const [domain, uiRoute, testTicket, screen] = mapping;
  const prefix = textArgument(decoratorCall(controllerClass, 'Controller'));
  const classPermissions = callArguments(controllerClass, 'RequirePermissions');
  const classGuards = callArguments(controllerClass, 'UseGuards');
  const sourceFile = relative(apiRoot, file).replaceAll('\\', '/');

  return controllerClass.members.filter(ts.isMethodDeclaration).flatMap((method) => {
    const httpDecorator = decorators(method).find((decorator) =>
      ['Delete', 'Get', 'Patch', 'Post', 'Put'].includes(decoratorName(decorator)),
    );
    if (!httpDecorator || !ts.isCallExpression(httpDecorator.expression)) return [];
    const httpMethod = decoratorName(httpDecorator).toUpperCase();
    const suffix = textArgument(httpDecorator.expression);
    const methodPermissions = callArguments(method, 'RequirePermissions');
    const guards = [...classGuards, ...callArguments(method, 'UseGuards')];
    const permissions = [...new Set([...classPermissions, ...methodPermissions])];
    const operation = method.name.getText();
    const operationKey = `${controller}#${operation}`;
    const operationExclusion = NO_WEB_UI_OPERATIONS.get(operationKey);
    const operationUi = OPERATION_UI_OVERRIDES.get(operationKey);
    const excludesWebUi = NO_WEB_UI_DOMAINS.has(domain) || Boolean(operationExclusion);
    const resolvedRoute = operationUi?.[0] ?? uiRoute;
    const resolvedTicket = operationUi?.[1] ?? testTicket;
    const resolvedScreen = operationUi?.[2] ?? screen;
    const methodText = method.getText();
    const states =
      httpMethod === 'GET'
        ? ['loading', 'ready', 'empty', 'error']
        : ['idle', 'submitting', 'success', 'error'];
    const errors = new Set(['server-error']);
    if (methodText.includes('@Body') || methodText.includes('@Query')) errors.add('validation');
    if (guards.some((guard) => guard.includes('SessionGuard'))) errors.add('unauthorized');
    if (permissions.length || guards.some((guard) => guard !== 'SessionGuard')) {
      errors.add('forbidden');
    }
    if (methodText.includes('@Param')) errors.add('not-found');
    if (httpMethod !== 'GET') errors.add('conflict');
    if (methodText.includes("@Headers('idempotency-key')")) errors.add('idempotency-required');
    return {
      controller,
      operation,
      method: httpMethod,
      path: routePath(prefix, suffix),
      capability: humanize(operation),
      domain,
      uiDisposition: excludesWebUi ? 'explicit-no-web-ui' : 'required',
      uiReason:
        operationExclusion ??
        NO_WEB_UI_REASONS[domain] ??
        'user-facing backend capability; routed Web workspace required',
      uiRoute: excludesWebUi ? null : resolvedRoute,
      screen: resolvedScreen,
      permissions: permissions.length ? permissions : guards.length ? guards : ['PUBLIC'],
      guards: guards.length ? [...new Set(guards)] : ['NONE'],
      states,
      errors: [...errors].sort(),
      test: `${resolvedTicket}; UIN-208; UIN-211`,
      source: `${sourceFile}#${operation}`,
    };
  });
};

const files = await walk(apiSrc);
const controllers = await Promise.all(files.map(extractController));
const records = controllers
  .flat()
  .sort((left, right) =>
    `${left.domain}:${left.controller}:${left.path}:${left.method}`.localeCompare(
      `${right.domain}:${right.controller}:${right.path}:${right.method}`,
    ),
  );

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
for (const [domain, fileName] of Object.entries(DOMAIN_FILES)) {
  const lines = records.filter((record) => record.domain === domain).map(JSON.stringify);
  await writeFile(join(outputRoot, fileName), `${lines.join('\n')}\n`);
}

const controllerNames = [...new Set(records.map(({ controller }) => controller))].sort();
const { stdout: apiRevisionOutput } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
  cwd: apiRoot,
});
const digest = createHash('sha256')
  .update(
    records
      .map(({ method, path, controller, permissions }) =>
        JSON.stringify({ controller, method, path, permissions }),
      )
      .join('\n'),
  )
  .digest('hex');
const manifest = {
  schemaVersion: 1,
  generatedFrom: basename(apiRoot),
  apiRevision: apiRevisionOutput.trim(),
  controllerCount: controllerNames.length,
  endpointCount: records.length,
  controllerNames,
  contractDigest: digest,
  files: Object.values(DOMAIN_FILES),
};
await writeFile(join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated ${records.length} endpoints from ${controllerNames.length} controllers.`);
