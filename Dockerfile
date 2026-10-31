FROM node:22-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
# Valor ficticio solo para el build; la URL real se inyecta en runtime.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3050 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
# CLI de Prisma completa (con sus dependencias) para aplicar migraciones al arrancar
RUN npm install -g prisma@6.19.3
RUN mkdir -p public/uploads/receipts && chown -R node:node /app
USER node
EXPOSE 3050
CMD ["sh", "-c", "prisma migrate deploy && node server.js"]
