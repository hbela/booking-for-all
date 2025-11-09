# syntax=docker/dockerfile:1.6
FROM node:22-bullseye

WORKDIR /app

# Install global toolchain
RUN npm install -g pnpm@10 turbo@2

# Copy the workspace
COPY . .

# Install deps & build server
RUN pnpm install --frozen-lockfile \
 && pnpm --filter @booking-for-all/db exec prisma generate --no-engine \
 && pnpm turbo run build --filter=server

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

EXPOSE 3000

CMD ["pnpm", "turbo", "run", "start", "--filter=server"]
