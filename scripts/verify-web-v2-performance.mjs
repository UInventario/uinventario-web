import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKSPACE_PATHS = [
  'dashboard',
  'catalogo',
  'inventario',
  'compras',
  'ventas',
  'reportes',
  'administracion',
];

function bytes(value) {
  const match = /^(\d+(?:\.\d+)?)(kb|mb)$/i.exec(value ?? '');
  if (!match) return Number.POSITIVE_INFINITY;
  return Number(match[1]) * (match[2].toLowerCase() === 'mb' ? 1024 : 1);
}

async function source(workspaceRoot, relativePath) {
  return readFile(resolve(workspaceRoot, relativePath), 'utf8');
}

export async function inspectWebV2Performance({ workspaceRoot = process.cwd() } = {}) {
  const violations = [];
  const angular = JSON.parse(await source(workspaceRoot, 'angular.json'));
  const production =
    angular.projects?.['uinventario-web-v2']?.architect?.build?.configurations?.production;
  const budgets = production?.budgets ?? [];
  const initial = budgets.find((budget) => budget.type === 'initial');
  const componentStyle = budgets.find((budget) => budget.type === 'anyComponentStyle');

  if (!initial || bytes(initial.maximumWarning) > 550 || bytes(initial.maximumError) > 600) {
    violations.push('bundle inicial debe advertir a 550kB y fallar como máximo a 600kB');
  }
  if (!componentStyle || bytes(componentStyle.maximumError) > 8) {
    violations.push('estilos de componente deben fallar como máximo a 8kB');
  }

  const routes = await source(workspaceRoot, 'projects/uinventario-web-v2/src/app/app.routes.ts');
  for (const path of WORKSPACE_PATHS) {
    const route = new RegExp(`path: '${path.replace('/', '\\/')}'[\\s\\S]{0,260}?loadChildren:`);
    if (!route.test(routes))
      violations.push(`workspace '${path}' debe cargar por ruta con loadChildren`);
  }
  if (/from ['"]\.\/features\//.test(routes)) {
    violations.push('app.routes no debe importar módulos funcionales de forma estática');
  }

  const appConfig = await source(
    workspaceRoot,
    'projects/uinventario-web-v2/src/app/app.config.ts',
  );
  if (/PreloadAllModules|withPreloading/.test(appConfig)) {
    violations.push('los workspaces no deben precargarse globalmente');
  }

  const serviceWorker = JSON.parse(
    await source(workspaceRoot, 'projects/uinventario-web-v2/ngsw-config.json'),
  );
  const javascriptGroups = serviceWorker.assetGroups.filter((group) =>
    group.resources?.files?.some((file) => file.includes('.js')),
  );
  if (!javascriptGroups.length || javascriptGroups.some((group) => group.installMode !== 'lazy')) {
    violations.push('los chunks JavaScript deben instalarse de forma lazy en el Service Worker');
  }

  const dashboard = await source(
    workspaceRoot,
    'projects/uinventario-web-v2/src/app/features/dashboard/ui/dashboard-overview-page/dashboard-overview-page.ts',
  );
  if (!dashboard.includes('forkJoin({')) {
    violations.push('Dashboard debe resolver widgets independientes en paralelo');
  }

  for (const [name, templatePath, componentPath] of [
    [
      'catálogo',
      'projects/uinventario-web-v2/src/app/features/catalog/ui/catalog-page/catalog-page.html',
      'projects/uinventario-web-v2/src/app/features/catalog/ui/catalog-page/catalog-page.ts',
    ],
    [
      'inventario',
      'projects/uinventario-web-v2/src/app/features/inventory/ui/inventory-page/inventory-page.html',
      'projects/uinventario-web-v2/src/app/features/inventory/ui/inventory-page/inventory-page.ts',
    ],
  ]) {
    const [template, component] = await Promise.all([
      source(workspaceRoot, templatePath),
      source(workspaceRoot, componentPath),
    ]);
    if (!template.includes('class="pagination"') || !/pageSize:\s*20(?!\d)/.test(component)) {
      violations.push(`${name} debe paginar sus listas principales en bloques acotados`);
    }
  }

  return { violations, initialBudget: initial, workspaceCount: WORKSPACE_PATHS.length };
}

export async function verifyWebV2Performance(options) {
  const result = await inspectWebV2Performance(options);
  if (result.violations.length) {
    throw new Error(`Presupuestos Web V2 inválidos:\n- ${result.violations.join('\n- ')}`);
  }
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await verifyWebV2Performance();
    console.log(
      `Rendimiento Web V2 verificado: ${result.workspaceCount} workspaces lazy; límite inicial ${result.initialBudget.maximumError}.`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
