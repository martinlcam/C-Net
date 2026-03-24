FROM oven/bun:1 AS base

FROM base AS builder
WORKDIR /app
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
WORKDIR /app
COPY --from=installer /app/ .
CMD ["bun", "run", "apps/workers/dist/worker.js"]
