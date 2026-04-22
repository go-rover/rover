# go-rover/rover — image terpisah dari monorepo gorover-app (bukan `Dockerfile.rover` di repo itu).
# Railway: Settings → Build → Docker, atau `railway.toml` [build] builder = DOCKERFILE, dockerfilePath = /Dockerfile

FROM oven/bun:1.3 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1.3
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json /app/bun.lock ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/rover.config.example.ts ./rover.config.example.ts

CMD ["bun", "dist/cmd.js", "start", "rover.config.example.ts"]
