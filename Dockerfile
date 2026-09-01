# syntax=docker/dockerfile:1

FROM node:24-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY .postcssrc.json angular.json ngsw-config.json tsconfig.json tsconfig.app.json ./
COPY public ./public
COPY src ./src
COPY projects ./projects
ARG LICENSE_CACHE_BUST
RUN --mount=type=secret,id=primeui_license,required=true \
    PRIMEUI_LICENSE="$(cat /run/secrets/primeui_license)" && \
    test -n "$LICENSE_CACHE_BUST" && \
    printf '%s' "$PRIMEUI_LICENSE" | grep -Eq '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' && \
    npm run build:v1 && \
    npx ng build uinventario-web-v2 --configuration production \
      --define="PRIMEUI_LICENSE='${PRIMEUI_LICENSE}'"

FROM node:24-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43 AS runtime
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app
COPY --from=build --chown=node:node /app/dist/uinventario-web/browser ./public
COPY --from=build --chown=node:node /app/dist/uinventario-web-v2/browser ./public/v2
COPY --chown=node:node server.mjs ./
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
