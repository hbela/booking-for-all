# syntax=docker/dockerfile:1.6
FROM node:22-bullseye

WORKDIR /app

# Install workspace toolchain
RUN npm install -g pnpm@10 turbo@2

# Copy the monorepo
COPY . .

# Install dependencies and build the web app
RUN pnpm install --frozen-lockfile \
 && pnpm --filter web run build

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4173

EXPOSE 4173

# Serve the prebuilt Vite app
CMD ["pnpm", "--filter", "web", "run", "serve", "--", "--host", "0.0.0.0", "--port", "4173"]
