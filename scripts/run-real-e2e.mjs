import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiDirectory = resolve(
  process.env.UINVENTARIO_API_DIR ?? resolve(webDirectory, '..', 'uinventario-api'),
);
const mysqlImage = process.env.E2E_MYSQL_IMAGE ?? 'mysql:8.4';
const containerName = `uinventario-real-e2e-${process.pid}`;
const databasePassword = 'uinventario-e2e-only';
let apiProcess;
let playwrightProcess;
let apiLog = '';
let containerStarted = false;
let cleaning = false;

if (!existsSync(resolve(apiDirectory, 'package.json'))) {
  throw new Error(
    `No se encontro uinventario-api en ${apiDirectory}. Define UINVENTARIO_API_DIR si esta en otra ruta.`,
  );
}

function docker(args, options = {}) {
  const result = spawnSync('docker', args, {
    cwd: webDirectory,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(options.capture ? result.stderr || result.stdout : `docker ${args[0]} fallo.`);
  }
  return options.capture ? result.stdout.trim() : '';
}

async function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('No fue posible reservar un puerto local.'));
        return;
      }
      server.close(() => resolvePort(address.port));
    });
  });
}

async function waitFor(label, check, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      if (await check()) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 1_000));
  }
  throw new Error(`${label} no estuvo disponible a tiempo.`, { cause: lastError });
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
  await Promise.race([
    new Promise((resolveExit) => child.once('exit', resolveExit)),
    new Promise((resolveWait) => setTimeout(resolveWait, 5_000)),
  ]);
}

async function cleanup() {
  if (cleaning) return;
  cleaning = true;
  await stopProcess(playwrightProcess);
  await stopProcess(apiProcess);
  if (containerStarted) {
    spawnSync('docker', ['rm', '--force', containerName], { stdio: 'ignore' });
    containerStarted = false;
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    await cleanup();
    process.exit(130);
  });
}

let exitCode;
try {
  docker(['version'], { capture: true });
  const [databasePort, apiPort, webPort] = await Promise.all([freePort(), freePort(), freePort()]);

  docker(
    [
      'run',
      '--detach',
      '--rm',
      '--name',
      containerName,
      '--tmpfs',
      '/var/lib/mysql:rw,noexec,nosuid,size=512m',
      '--health-cmd',
      'mysqladmin ping -h 127.0.0.1 -p"$MYSQL_ROOT_PASSWORD"',
      '--health-interval',
      '2s',
      '--health-timeout',
      '2s',
      '--health-retries',
      '40',
      '-e',
      'MYSQL_DATABASE=uinventario_e2e',
      '-e',
      'MYSQL_USER=uinventario_e2e',
      '-e',
      `MYSQL_PASSWORD=${databasePassword}`,
      '-e',
      `MYSQL_ROOT_PASSWORD=${databasePassword}`,
      '-p',
      `127.0.0.1:${databasePort}:3306`,
      mysqlImage,
    ],
    { capture: true },
  );
  containerStarted = true;

  await waitFor('MySQL efimero', () => {
    const status = docker(['inspect', '--format', '{{.State.Health.Status}}', containerName], {
      capture: true,
    });
    return status === 'healthy';
  });

  const webOrigin = `http://127.0.0.1:${webPort}`;
  apiProcess = spawn(
    process.execPath,
    [resolve(apiDirectory, 'node_modules', '@nestjs', 'cli', 'bin', 'nest.js'), 'start'],
    {
      cwd: apiDirectory,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DEPLOY_ENV: 'local',
        PORT: String(apiPort),
        CORS_ORIGINS: webOrigin,
        DATABASE_URL: `mysql://uinventario_e2e:${databasePassword}@127.0.0.1:${databasePort}/uinventario_e2e`,
        DB_MIGRATIONS_RUN: 'true',
        SESSION_COOKIE_NAME: 'uinventario_e2e_session',
        SESSION_TTL_MINUTES: '60',
        PASSWORD_RESET_TTL_MINUTES: '10',
        PASSWORD_RESET_PUBLIC_URL: `${webOrigin}/v2/restablecer`,
        PASSWORD_RESET_DELIVERY: 'disabled',
        POS_TAX_RATES: 'MX=0.1600,CL=0.1900,DEFAULT=0.0000',
      },
    },
  );

  const collectApiLog = (chunk) => {
    apiLog = `${apiLog}${chunk.toString()}`.slice(-100_000);
  };
  apiProcess.stdout.on('data', collectApiLog);
  apiProcess.stderr.on('data', collectApiLog);

  apiProcess.once('exit', (code) => {
    if (!cleaning && code !== null) console.error(`La API termino antes de tiempo (${code}).`);
  });

  await waitFor('API real', async () => {
    const response = await fetch(`http://127.0.0.1:${apiPort}/health/ready`);
    return response.ok;
  });

  playwrightProcess = spawn(
    process.execPath,
    [
      resolve(webDirectory, 'node_modules', '@playwright', 'test', 'cli.js'),
      'test',
      '--config',
      'playwright.real.config.ts',
      ...process.argv.slice(2),
    ],
    {
      cwd: webDirectory,
      detached: process.platform !== 'win32',
      stdio: 'inherit',
      env: {
        ...process.env,
        E2E_API_URL: `http://127.0.0.1:${apiPort}`,
        E2E_WEB_PORT: String(webPort),
      },
    },
  );
  exitCode = await new Promise((resolveExit) =>
    playwrightProcess.once('exit', (code) => resolveExit(code ?? 1)),
  );
} finally {
  if ((exitCode ?? 1) !== 0 && apiLog.trim()) {
    console.error(`\nDiagnostico de la API real:\n${apiLog.trim()}`);
  }
  await cleanup();
}

process.exitCode = exitCode ?? 1;
