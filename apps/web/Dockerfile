# syntax=docker/dockerfile:1.6
FROM node:22-bullseye

WORKDIR /app

# Install workspace toolchain
RUN npm install -g pnpm@10 turbo@2

# Install Chrome/Chromium dependencies for Puppeteer prerendering
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-sandbox \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Set Chrome path for Puppeteer
ENV CHROME_PATH=/usr/bin/chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Copy the monorepo
COPY . .

# Install dependencies and build the web app
# TEMPORARILY: Using build:no-prerender to debug blank page issue
RUN pnpm install --frozen-lockfile \
 && pnpm --filter web run build:no-prerender

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4173

EXPOSE 4173

# Serve the prebuilt Vite app using vite preview (simpler, no Express needed)
CMD ["pnpm", "--filter", "web", "run", "start:preview"]

