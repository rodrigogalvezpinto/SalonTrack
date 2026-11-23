FROM node:24-slim AS build

WORKDIR /app

RUN npm i -g npm@10.8.3

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:24-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    DATABASE_FILE=/data/salontrack.sqlite

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/server.ts ./server.ts
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/tsconfig.json ./tsconfig.json
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --chmod=755 docker-entrypoint.sh ./docker-entrypoint.sh

RUN mkdir -p /data && chown node:node /data

VOLUME /data
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || '3000') + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node_modules/.bin/tsx", "server.ts"]
