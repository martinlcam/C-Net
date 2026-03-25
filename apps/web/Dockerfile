FROM oven/bun:1 AS base

FROM base AS builder
WORKDIR /app
# Context is trimmed by repo-root .dockerignore (no secrets / node_modules in image).
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
RUN groupadd --system --gid 1001 cnet \
  && useradd --system --uid 1001 --gid cnet --home /app cnet
WORKDIR /app
COPY --from=installer --chown=cnet:cnet /app/ .
USER cnet
EXPOSE 3001
CMD ["bun", "run", "apps/web/node_modules/.bin/next", "start", "-p", "3001"]
