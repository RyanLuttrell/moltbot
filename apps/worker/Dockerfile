FROM node:22-bookworm AS base

# Install Bun (required for build scripts)
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

RUN corepack enable

WORKDIR /app

# Copy workspace root files for dependency resolution
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY patches ./patches
COPY scripts ./scripts

# Copy workspace package manifests for install
COPY apps/worker/package.json ./apps/worker/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/ ./packages/
COPY ui/package.json ./ui/package.json
COPY extensions/ ./extensions/

RUN pnpm install --frozen-lockfile

# Copy full source and build the root moltbot package
COPY . .
RUN CLAWDBOT_A2UI_SKIP_MISSING=1 pnpm build

# Build the worker
RUN cd apps/worker && pnpm build

ENV NODE_ENV=production

# Ensure /data is writable by non-root user
RUN mkdir -p /data && chown node:node /data

# Security: run as non-root
USER node

EXPOSE 3001

CMD ["node", "apps/worker/dist/index.js"]
