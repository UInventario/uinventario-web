# Estrategia de pruebas Web V2

La suite valida comportamiento público del frontend Angular nuevo. No importa pruebas, fixtures ni datos demo del frontend anterior.

## Capas

- `domain`: cálculos exactos, cantidades, dinero e invariantes puros.
- `application`: normalización, composición y comandos enviados a gateways.
- `data`: rutas, parámetros, envelopes, idempotencia y propagación de errores normalizados.
- `ui`: estados visibles, permisos y acciones del usuario mediante `TestBed`.
- `e2e-v2`: recorridos completos; UIN-211 cubre los críticos contra datos aislados.

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

## Gates

- `npm run test:strategy`: estructura, riesgos obligatorios, aislamiento y máximo de 500 líneas.
- `npm run test:v2 -- --watch=false`: suite Angular Web V2.
- `npm run test:e2e:v2`: recorridos Playwright en escritorio y móvil.

Los fallos deben conservar trace/capturas; las ejecuciones exitosas no publican artefactos de diagnóstico.
