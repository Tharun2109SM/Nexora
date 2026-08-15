# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS builder
WORKDIR /app

RUN npm install --global pnpm@11.19.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN pnpm install --frozen-lockfile --filter @nexora/api...

COPY apps/api apps/api
COPY packages/contracts packages/contracts
RUN pnpm --filter @nexora/contracts build \
  && pnpm --filter @nexora/api build \
  && pnpm deploy --filter @nexora/api --prod --legacy /app/deploy

FROM node:24-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup --system --gid 1001 nexora \
  && adduser --system --uid 1001 --ingroup nexora nexora

COPY --from=builder --chown=nexora:nexora /app/deploy ./
COPY --from=builder --chown=nexora:nexora /app/packages/contracts ./packages/contracts
RUN ln -sfn ../../packages/contracts /app/node_modules/@nexora/contracts

USER nexora
EXPOSE 4000

CMD ["node", "dist/server.js"]
