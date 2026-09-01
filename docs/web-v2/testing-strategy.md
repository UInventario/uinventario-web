# Estrategia de pruebas Web V2

La suite valida comportamiento público del frontend Angular nuevo. No importa pruebas, fixtures ni datos demo del frontend anterior.

## Capas

- `domain`: cálculos exactos, cantidades, dinero e invariantes puros.
- `application`: normalización, composición y comandos enviados a gateways.
- `data`: rutas, parámetros, envelopes, idempotencia y propagación de errores normalizados.
- `ui`: estados visibles, permisos y acciones del usuario mediante `TestBed`.
- `e2e-v2`: recorridos rápidos de navegador contra contratos simulados.
- `e2e-real`: recorridos críticos contra NestJS, migraciones y MySQL reales y efímeros.

## Riesgos obligatorios

| Riesgo        | Evidencia mínima                                              |
| ------------- | ------------------------------------------------------------- |
| Autenticación | sesión, refresh, credenciales y navegación segura             |
| Tenant        | cambio de contexto, respuestas tardías y clave de aislamiento |
| Stock         | contratos de inventario, permisos y cantidades exactas        |
| Dinero        | centavos enteros, pagos, caja y valorización                  |
| Contratos     | mapeo de envelopes, parámetros, errores e idempotencia        |
| Componentes   | estados, permisos y confirmaciones visibles                   |

Los identificadores usados por una prueba pertenecen al escenario aislado de esa prueba. Está prohibido importar seeds, fixtures demo o código del frontend anterior.

## Gate E2E real

- `npm run test:e2e:real`: registro, onboarding, producto, stock y venta real en escritorio y móvil; también verifica permisos, aislamiento entre tenants, dinero y descuento de inventario.

El gate crea un contenedor MySQL con `tmpfs`, usa puertos locales libres y elimina el contenedor al finalizar. La API se toma del repositorio hermano `uinventario-api`; en CI ambos repositorios se instalan desde sus lockfiles. Ningún dato sobrevive a la ejecución.

## Gates

- `npm run test:strategy`: estructura, riesgos obligatorios, aislamiento y máximo de 500 líneas.
- `npm run test:v2 -- --watch=false`: suite Angular Web V2.
- `npm run test:e2e:v2`: recorridos Playwright en escritorio y móvil.

Los fallos deben conservar trace/capturas; las ejecuciones exitosas no publican artefactos de diagnóstico.
