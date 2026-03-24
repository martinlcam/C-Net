FROM oven/bun:1 AS base

FROM base AS builder
WORKDIR /app
COPY . .
RUN bun install
RUN bunx turbo prune @cnet/api --docker

FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
RUN bun install
COPY --from=builder /app/out/full/ .
RUN bunx turbo build --filter=@cnet/api

FROM base AS runner
WORKDIR /app
COPY --from=installer /app/ .
EXPOSE 4000
CMD ["bun", "run", "apps/api/dist/index.js"]
