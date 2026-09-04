# Lead Scraper — worker (Playwright + BullMQ consumer). Build eseguito dalla root del repo
# (context: .) cosi' da poter includere prisma/schema.prisma condiviso col web.
FROM mcr.microsoft.com/playwright:v1.48.0-jammy AS base
WORKDIR /app

COPY package.json package-lock.json ./
COPY worker/package.json ./worker/package.json
RUN npm ci

# L'immagine base ha i browser precompilati per la versione di Playwright taggata nell'immagine
# stessa — se package.json risolve una versione npm diversa (es. "^1.48.0" -> 1.62.x), il
# percorso dei binari non combacia e chromium.launch() fallisce con "Executable doesn't exist"
# (bug reale riscontrato in produzione: ogni sito veniva erroneamente segnato come "datato").
# Si reinstalla sempre la build di Chromium che corrisponde alla versione npm effettivamente usata.
RUN npx playwright install chromium

COPY prisma ./prisma
RUN npx prisma generate

COPY worker ./worker
RUN npm run build --workspace=worker

CMD ["node", "worker/dist/index.js"]
