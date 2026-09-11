# ── Stage 1: Build frontend ─────────────────────────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --legacy-peer-deps

COPY frontend/ .
ARG VITE_APP_HOST
ENV VITE_APP_HOST=${VITE_APP_HOST}
RUN npm run build

# ── Stage 2: Build backend ───────────────────────────────────────────────────
FROM node:20-alpine AS backend-build

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --legacy-peer-deps

COPY backend/ .
RUN ./node_modules/.bin/prisma generate
RUN npm run build

# ── Stage 3: Runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

RUN apk add --no-cache openssl

WORKDIR /app

# Copy built backend (full deps — keeps prisma CLI for migrate)
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=backend-build /app/backend/node_modules ./node_modules
COPY --from=backend-build /app/backend/package.json ./package.json
COPY --from=backend-build /app/backend/prisma ./prisma

# Copy built frontend into backend's public dir
COPY --from=frontend-build /app/frontend/dist ./public

ENV NODE_ENV=production
EXPOSE 3000

# Migrations run via fly.toml [deploy] release_command (once per deploy), NOT on
# every machine boot — otherwise a scale-to-zero cold start pays ~25s to run
# `migrate deploy` just to find nothing pending. Keep the runtime CMD minimal.
CMD ["node", "dist/main.js"]
