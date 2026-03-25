FROM oven/bun:1 AS base

FROM base AS builder
WORKDIR /app
# Context is trimmed by repo-root .dockerignore (no secrets / node_modules in image).
COPY . .
RUN bun install
RUN bunx turbo prune @cnet/workers --docker

FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
RUN bun install
COPY --from=builder /app/out/full/ .
RUN bunx turbo build --filter=@cnet/workers

FROM base AS runner
RUN groupadd --system --gid 1001 cnet \
  && useradd --system --uid 1001 --gid cnet --home /app cnet
WORKDIR /app
COPY --from=installer --chown=cnet:cnet /app/ .
USER cnet
CMD ["bun", "run", "apps/workers/dist/worker.js"]
