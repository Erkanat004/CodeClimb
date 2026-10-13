FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build:network

FROM node:24-bookworm-slim AS web
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 CODE_CLIMB_NETWORK=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next-network/standalone ./
COPY --from=build --chown=node:node /app/.next-network/static ./.next-network/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]

FROM node:24-bookworm-slim AS api
WORKDIR /app
ENV NODE_ENV=production CODE_CLIMB_PUBLIC=1 ACCOUNT_HOST=0.0.0.0 ACCOUNT_PORT=3001 SQLITE_PATH=/data/code-climb.sqlite
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev
COPY --chown=node:node server ./server
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 3001
CMD ["node", "server/index.mjs"]
