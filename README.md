# UInventario Web

Cliente Web Angular de UInventario. Web es el primer cliente operativo; Mobile y Desktop se incorporarán después del Core usable.

## Desarrollo local

```bash
npm install
npm start
```

La aplicación queda disponible en `http://localhost:4200`.

La URL de la API se carga en tiempo de ejecución desde `public/config.json`. Para cada ambiente, el pipeline debe sustituir ese archivo sin recompilar secretos ni guardarlos en el repositorio.

## Gates

```bash
npm run typecheck
npm test -- --watch=false
npm run build
```

## Ramas

- `master`: última versión estable publicada.
- `develop`: integración preparada para el siguiente despliegue.
- `feature/*`: trabajo aislado por ticket Jira.
