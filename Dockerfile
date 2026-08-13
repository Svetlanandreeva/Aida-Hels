FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
# Production build must never ship legacy demo identities, guest fallback auth,
# raw OTP responses or implicit consent defaults. Apply the deterministic
# hardening codemod before compiling the server bundle.
RUN node scripts/harden-server-auth.mjs
RUN bun run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
EXPOSE 3000
CMD ["node", "dist/server.cjs"]
