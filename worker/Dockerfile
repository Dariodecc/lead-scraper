# Lead Scraper — worker (Playwright + BullMQ consumer). Build eseguito dalla root del repo
# (context: .) cosi' da poter includere prisma/schema.prisma condiviso col web.
FROM mcr.microsoft.com/playwright:v1.48.0-jammy AS base
WORKDIR /app

COPY package.json package-lock.json ./
COPY worker/package.json ./worker/package.json
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY worker ./worker
RUN npm run build --workspace=worker

CMD ["node", "worker/dist/index.js"]
