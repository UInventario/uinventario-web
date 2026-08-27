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
