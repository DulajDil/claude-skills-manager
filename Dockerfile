FROM node:20-alpine AS base
WORKDIR /app

# Install server deps
FROM base AS server-deps
COPY server/package.json ./server/
RUN cd server && npm install --production=false

# Install client deps
FROM base AS client-deps
COPY client/package.json ./client/
RUN cd client && npm install

# Build client
FROM client-deps AS client-build
COPY client/ ./client/
RUN cd client && npm run build

# Build server
FROM server-deps AS server-build
COPY server/ ./server/
RUN cd server && npm run build

# Production image
FROM node:20-alpine AS production
WORKDIR /app

COPY server/package.json ./server/
RUN cd server && npm install --omit=dev

COPY --from=server-build /app/server/dist ./server/dist
COPY --from=client-build /app/client/dist ./client/dist

# The starter set is resolved relative to server/dist, so it has to ship too.
COPY bundled-skills ./bundled-skills

EXPOSE 3002

ENV NODE_ENV=production

CMD ["node", "server/dist/index.js"]
