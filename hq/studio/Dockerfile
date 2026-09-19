# Build from monorepo root: docker build -f hq/studio/Dockerfile .
FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY patches patches
COPY hq/studio/package.json hq/studio/package.json
COPY hq/studio/.npmrc hq/studio/.npmrc

RUN pnpm install --filter relaybase-studio --frozen-lockfile

COPY hq/studio hq/studio

WORKDIR /app/hq/studio
RUN pnpm run build

ENV NODE_ENV=production
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# ESM output uses extensionless imports; tsx resolves them at runtime.
CMD ["pnpm", "exec", "tsx", "dist/index.js"]
