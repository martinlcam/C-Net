FROM oven/bun:1 AS base

FROM base AS builder
WORKDIR /app
COPY . .
RUN bun install
RUN bunx turbo prune @cnet/web --docker

FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
RUN bun install
COPY --from=builder /app/out/full/ .
RUN bunx turbo build --filter=@cnet/web

FROM base AS runner
WORKDIR /app
COPY --from=installer /app/ .
EXPOSE 3001
CMD ["bun", "run", "apps/web/node_modules/.bin/next", "start", "-p", "3001"]
