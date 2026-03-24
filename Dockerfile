FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Install dependencies
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/api/package.json ./packages/api/package.json
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/api ./packages/api
RUN pnpm --filter @pipeai/shared build && pnpm --filter @pipeai/api build

# Production image
FROM node:20-slim
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages/shared/dist ./packages/shared/dist
COPY --from=base /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=base /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=base /app/packages/api/dist ./packages/api/dist
COPY --from=base /app/packages/api/package.json ./packages/api/package.json
COPY --from=base /app/packages/api/node_modules ./packages/api/node_modules
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

EXPOSE 3000
CMD ["node", "packages/api/dist/index.js"]
