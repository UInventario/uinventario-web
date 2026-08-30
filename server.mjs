import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(currentDirectory, 'public');
const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function validateConfiguration(environment, apiUpstream) {
  if (!['local', 'dev', 'prod'].includes(environment)) {
    throw new Error('DEPLOY_ENV must be local, dev or prod.');
  }

  let parsed;
  try {
    parsed = new URL(apiUpstream);
  } catch {
    throw new Error('API_UPSTREAM must be an absolute HTTP(S) origin.');
  }

  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.origin !== apiUpstream ||
    parsed.username ||
    parsed.password ||
    (environment !== 'local' && parsed.protocol !== 'https:')
  ) {
    throw new Error('API_UPSTREAM must be a secure origin for this environment.');
  }

  return parsed;
}

function setSecurityHeaders(response, environment) {
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; base-uri 'self'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'",
  );
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  if (environment !== 'local') {
    response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

function sendJson(response, statusCode, body) {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(payload),
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(payload);
}

function proxyToApi(request, response, upstream) {
  const target = new URL(request.url, upstream);
  const transport = target.protocol === 'https:' ? httpsRequest : httpRequest;
  const headers = { ...request.headers, host: target.host };

  const proxy = transport(target, { method: request.method, headers }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });

  proxy.setTimeout(60_000, () => proxy.destroy(new Error('API request timed out.')));
  proxy.on('error', () => {
    if (!response.headersSent) {
      sendJson(response, 502, { message: 'El servicio no está disponible temporalmente.' });
    } else {
      response.destroy();
    }
  });
  request.pipe(proxy);
}

async function sendFile(response, filePath, cacheControl) {
  const metadata = await stat(filePath);
  if (!metadata.isFile()) throw new Error('Not a file');

  response.writeHead(200, {
    'Cache-Control': cacheControl,
    'Content-Length': metadata.size,
    'Content-Type': mimeTypes.get(extname(filePath)) ?? 'application/octet-stream',
  });
  createReadStream(filePath).pipe(response);
}

export function createApplicationServer({
  rootDirectory = defaultRoot,
  environment = process.env.DEPLOY_ENV ?? '',
  apiUpstream = process.env.API_UPSTREAM ?? '',
} = {}) {
  const upstream = validateConfiguration(environment, apiUpstream);
  const normalizedRoot = resolve(rootDirectory);

  return createServer(async (request, response) => {
    setSecurityHeaders(response, environment);

    const requestUrl = new URL(request.url ?? '/', 'http://localhost');
    if (requestUrl.pathname === '/health/live') {
      sendJson(response, 200, { status: 'ok' });
      return;
    }

    if (requestUrl.pathname === '/config.json') {
      sendJson(response, 200, { environment, apiBaseUrl: '/api/v1' });
      return;
    }

    if (requestUrl.pathname === '/api' || requestUrl.pathname.startsWith('/api/')) {
      proxyToApi(request, response, upstream);
      return;
    }

    if (!['GET', 'HEAD'].includes(request.method ?? '')) {
      sendJson(response, 405, { message: 'Método no permitido.' });
      return;
    }

    let decodedPath;
    try {
      decodedPath = decodeURIComponent(requestUrl.pathname);
    } catch {
      sendJson(response, 400, { message: 'Ruta inválida.' });
      return;
    }

    const requestedFile = resolve(normalizedRoot, `.${decodedPath}`);
    const insideRoot =
      requestedFile === normalizedRoot || requestedFile.startsWith(`${normalizedRoot}${sep}`);
    if (!insideRoot) {
      sendJson(response, 404, { message: 'Recurso no encontrado.' });
      return;
    }

    try {
      const cacheControl = /[-.][A-Z0-9]{8,}\.(?:css|js)$/i.test(requestedFile)
        ? 'public, max-age=31536000, immutable'
        : 'no-cache';
      await sendFile(response, requestedFile, cacheControl);
    } catch {
      if (extname(decodedPath)) {
        sendJson(response, 404, { message: 'Recurso no encontrado.' });
        return;
      }
      try {
        const indexPath =
          decodedPath === '/v2' || decodedPath.startsWith('/v2/')
            ? resolve(normalizedRoot, 'v2', 'index.html')
            : resolve(normalizedRoot, 'index.html');
        await sendFile(response, indexPath, 'no-cache');
      } catch {
        sendJson(response, 500, { message: 'La aplicación no está disponible.' });
      }
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number.parseInt(process.env.PORT ?? '8080', 10);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be a valid TCP port.');
  }

  createApplicationServer().listen(port, '0.0.0.0');
}
