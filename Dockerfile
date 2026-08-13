FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
# Production build hardening is deterministic and runs before compilation.
RUN node scripts/harden-server-auth.mjs
RUN node scripts/harden-server-access.mjs
RUN node scripts/harden-integrations.mjs
RUN bun run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
EXPOSE 8080
CMD ["node", "dist/server.cjs"]
