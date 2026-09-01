# Cutover de Web V2

Este runbook gobierna UIN-210. UIN-212 quedó resuelto con licencias Community almacenadas en
Secret Manager para Dev y Prod; Jira y Git contienen sólo los nombres, nunca los valores.

## Estado previo y contrato

- El mismo servicio Cloud Run publica Web V1 en `/` y Web V2 en `/v2/`.
- `develop` despliega automáticamente a `software-inventario-dev`.
- `master` despliega automáticamente a `software-inventario-prod`.
- Web V2 usa la misma API, sesión HttpOnly, tenant y contexto operativo que Web V1.
- Desktop Dev y Prod ya usan sus orígenes respectivos con `webPath: /v2/`; el cutover Web no
  requiere recompilar Desktop.
- La revisión Cloud Run anterior al corte es el rollback primario. No se elimina durante la ventana
  de observación.
- Cloud Build inyecta la licencia correspondiente mediante un secreto efímero de BuildKit. La
  licencia no se pasa como `ARG`, no queda en el historial de capas y sólo el bundle cliente recibe
  el valor requerido por PrimeNG.

## Evidencia del release candidate

Ejecutar una sola vez desde `uinventario-web` sobre el SHA candidato de `develop`:

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run parity:generate
npm run parity:verify
npm run architecture:verify
npm run performance:verify
npm run test:strategy
npm run test:ci
npm run test:server
npm run build
npm run test:service-worker
npm run test:e2e:v2
```

`parity:generate` debe leer el `HEAD` limpio de `../uinventario-api`. El manifiesto resultante debe
registrar ese SHA, y `parity:verify` debe confirmar todos los controladores y endpoints. Cada fila
queda clasificada como UI requerida o excepción explícita.

Validar Desktop sin modificar su configuración:

```bash
cd ../uinventario-desktop
node --test test/runtime-config.spec.mjs test/navigation-policy.spec.mjs
```

La evidencia debe confirmar que `config/environments.json` usa `/v2/` tanto para Dev como para
Prod y que sólo permite navegación dentro del origen configurado.

## Precondiciones del cutover

No iniciar UIN-210 hasta que todas sean verdaderas:

1. UIN-212 contiene una resolución inequívoca y las versiones habilitadas existen como
   `uinventario-dev-primeui-license` y `uinventario-prod-primeui-license`; Jira nunca contiene el
   valor.
2. El banner de licencia no aparece en un build equivalente al candidato productivo.
3. La matriz de paridad coincide con el SHA API que se promoverá.
4. CI, security checks y E2E críticos del candidato están verdes, sin P0/P1 abiertos.
5. Dev sirve el SHA candidato y los recorridos Registro → Login → Empresa → Producto → Stock →
   Venta funcionan con datos reales.
6. Se registran las revisiones de API y Web que reciben 100% del tráfico en Prod.

## Procedimiento de corte

1. Crear el PR de release `develop` → `master` y revisar el diff una vez.
2. En el cambio de UIN-210, convertir las entradas antiguas en redirecciones hacia Web V2:
   - `/` → `/v2/`;
   - `/registro`, `/login`, `/recuperar` y `/restablecer` → su ruta equivalente bajo `/v2/`;
   - `/app` y enlaces con fragmentos del frontend anterior → `/v2/dashboard/resumen`.
     Durante la observación se usa `307` con `Cache-Control: no-store` para que un rollback no quede
     anulado por cachés permanentes.
3. Mantener el bundle V1 dentro de la imagen durante la ventana de observación; no enlazarlo desde
   la navegación pública.
4. Fusionar a `master` y esperar que Cloud Build Prod termine con `SUCCESS`.
5. Confirmar que la revisión nueva recibe 100% del tráfico y conservar el nombre de la revisión
   anterior.
6. Verificar en el origen productivo:
   - `/health/live` responde 200;
   - `/config.json` declara `prod` y `/api/v1`, sin secretos;
   - `/` redirige a `/v2/`;
   - un deep link de Web V2 responde con su shell;
   - login, producto, stock y una venta controlada funcionan.
7. Confirmar que Desktop Prod abre el mismo origen bajo `/v2/` y no recibe una redirección fuera
   del origen permitido.

## Ventana de observación

Conservar durante siete días naturales:

- la revisión Web anterior;
- el bundle V1 en la imagen candidata;
- los SHA, build IDs, revisiones y resultados de smoke en UIN-210.

Interrumpir la ventana y ejecutar rollback ante cualquier P0/P1, pérdida de sesión, autorización o
aislamiento, diferencia de stock/dinero, fallo sostenido de rutas o incompatibilidad Desktop.

## Rollback

Enviar 100% del tráfico Web a la revisión registrada antes del corte:

```bash
gcloud run services update-traffic uinventario-web \
  --project=software-inventario-prod \
  --region=us-central1 \
  --to-revisions=REVISION_WEB_ANTERIOR=100
```

Después comprobar `/health/live`, `/config.json`, la entrada estable y un login. Si la release
también promovió API o migraciones, usar el rollback coordinado de
`uinventario-api/docs/operations/production-runbook.md`; nunca revertir migraciones automáticamente.

## Retirada de Web V1

Sólo después de completar los siete días sin P0/P1:

1. Crear un cambio separado dentro de UIN-210 que elimine el build y los archivos de Web V1.
2. Conservar las redirecciones de rutas antiguas hacia Web V2.
   Al terminar la ventana pueden cambiarse a `308` porque Web V1 ya no será un destino de rollback.
3. Ejecutar nuevamente build, pruebas del servidor y E2E de rutas/deep links.
4. Publicar el cambio por `develop` y después `master` siguiendo el flujo normal.
5. Cerrar UIN-210 únicamente cuando Producción y Desktop estén validados y el código anterior ya no
   forme parte de la imagen estable.
