# Arquitectura de UInventario Web V2

Web V2 se organiza por dominio y por responsabilidad. La estructura evita dependencias
horizontales entre funcionalidades y mantiene cada recorrido reemplazable y comprobable.

## Estructura

```text
src/app/
  core/                         infraestructura transversal y singleton
  shared/                       contratos y UI reutilizable sin conocimiento de negocio
  shell/                        composición, navegación y chrome de la aplicación
  features/<dominio>/
    <dominio>.routes.ts         única entrada pública para composición externa
    domain/                     entidades, value objects y puertos
    data/                       API, DTO, mappers e implementaciones de repositorios
    application/                casos de uso, facades y estado de pantalla
    ui/                         páginas y componentes presentacionales
```

No se crean capas vacías por adelantado. Cada vertical slice añade sólo las carpetas y piezas que
necesita, respetando esta ubicación.

## Dirección de dependencias

- Un feature nunca importa otro feature. Un contrato compartido se mueve a `shared`.
- Código externo a un feature sólo puede entrar por `<dominio>.routes.ts` en la raíz del dominio.
- `domain` no depende de Angular, PrimeNG, navegador, `core`, `shared` ni otras capas.
- `data` puede depender de `domain`, `core` y `shared`; nunca de `application` o `ui`.
- `application` puede depender de `domain`, `core` y `shared`; nunca de `data` o `ui`.
- `ui` puede depender de `application`, `domain`, `core` y `shared`; nunca de `data`.
- `shared` no importa `core`, `shell` ni `features`.
- `core` no importa `shell` ni `features`.
- `shell` compone rutas públicas; no alcanza archivos internos de un feature.

Las implementaciones `data` se conectan a puertos `domain` mediante providers en la entrada pública
del feature. Así los casos de uso no conocen HTTP, storage ni DTO.

## Contratos HTTP

- Los servicios `data` consumen `ApiClient` y declaran DTOs propios; no exponen DTOs como modelos de
  pantalla. La conversión se realiza mediante `ApiMapper` y `mapApiData`.
- `ApiRequestContext` recibe el tenant únicamente después de aceptar una sesión. El header de tenant
  aporta contexto, pero la autorización y el aislamiento continúan siendo responsabilidad de la
  sesión segura validada por el servidor.
- Cada request al API obtiene una correlación nueva; ni tenant ni correlación se envían a hosts
  externos.
- GET/HEAD/OPTIONS pueden reintentarse una vez ante errores transitorios. Una mutación sólo puede
  reintentarse si conserva una `Idempotency-Key` explícita.
- Las búsquedas reactivas usan `switchSearchRequest` para cancelar la solicitud anterior cuando
  cambian los filtros.

## Responsabilidad de archivos

- Componentes y páginas sólo coordinan interacción y renderizado.
- Facades exponen estado y comandos de una pantalla; no contienen HTTP ni mapeo de DTO.
- Servicios de API sólo transportan contratos remotos.
- Mappers convierten DTO a modelos de dominio y viceversa.
- Casos de uso implementan una operación de negocio.
- Un archivo fuente o de prueba tiene como máximo 500 líneas físicas.

## Gate local y CI

```bash
npm run architecture:verify
```

El comando prueba el propio validador y luego inspecciona Web V2. No existen excepciones por nombre
de archivo. Si una pieza supera el límite o rompe la dirección de imports, debe dividirse o moverse
a su boundary correcto.
