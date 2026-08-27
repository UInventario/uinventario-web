# UInventario Web

Cliente Web Angular de UInventario. Web es el primer cliente operativo; Mobile y Desktop se incorporarán después del Core usable.

## Desarrollo local

```bash
npm install
npm start
```

La aplicación queda disponible en `http://localhost:4200`.

El flujo inicial se encuentra en `/registro`: valida los datos, crea la cuenta mediante la API y continúa a `/login`.

La URL de la API se carga en tiempo de ejecución desde `public/config.json`. Para cada ambiente, el pipeline debe sustituir ese archivo sin recompilar secretos ni guardarlos en el repositorio.

## Gates

Registro e inicio de sesión forman un recorrido real hasta `/onboarding`. La cookie
queda bajo control del API y las rutas privadas validan la sesión al recargar.
La Web renueva la sesión poco antes de expirar, sincroniza rotación/logout entre
pestañas y vuelve a `/login` cuando la sesión termina.
La recuperación de contraseña ofrece una respuesta indistinguible para cuentas
conocidas y desconocidas, y consume enlaces temporales de un solo uso en `/restablecer`.
El primer paso de onboarding permite configurar y reanudar la empresa mínima antes
de crear la sucursal inicial.
El segundo crea en una sola operación la sucursal, bodega y ubicación general, y
mantiene ese contexto activo en la sesión.
El tercero crea la caja inicial y entra al producto con empresa, sucursal, bodega y
caja obtenidas de la sesión, sin IDs hardcodeados.
El catálogo permite crear productos reales con SKU, barcode opcional, categoría,
marca, costo y precio; los duplicados se muestran sin perder el formulario.
El mismo espacio lista, pagina y busca por nombre, SKU o código, y permite consultar
el detalle sin mezclar productos de otras empresas.
Desde el detalle se registra stock inicial, entradas y ajustes por ubicación; la
existencia mostrada proviene del saldo persistido y cada envío usa idempotencia.
La vista de existencias agrega los saldos reales por la sucursal y bodega activas,
con búsqueda de producto y estados claros de carga, vacío y error.
El punto de venta busca productos y mantiene un carrito cuya existencia, precios,
impuesto incluido y totales son recalculados por la API en el contexto de caja activo.
El cobro en efectivo registra una venta persistida, muestra folio y cambio, y evita
duplicados durante envíos o reintentos; al confirmarse, refresca la existencia real.
El historial permite filtrar ventas de la sucursal activa y auditar líneas, efectivo,
caja, usuario y movimientos de inventario desde su detalle.

```bash
npm run typecheck
npx ng test --watch=false
npm run test:e2e
npm run build
```

El E2E requiere MySQL local sano y el build actual de `uinventario-api`; Playwright levanta temporalmente API y Web.

## Ramas

- `master`: última versión estable publicada.
- `develop`: integración preparada para el siguiente despliegue.
- `feature/*`: trabajo aislado por ticket Jira.
