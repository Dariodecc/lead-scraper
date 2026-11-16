This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Consegna al CRM MDNT

Il worker usa `TWENTY_BASE_URL` e `TWENTY_API_KEY`. Impostare
`TWENTY_SYNC_START_AT` con una data ISO completa di fuso orario per attivare il flusso
dai nuovi risultati. Lasciarla vuota per sospendere la consegna al CRM. Applicare
lo schema Prisma prima di aggiornare i container web e worker.

Per i lead **Da verificare**, aprire la scheda del risultato e usare il codice
dell'operatore (`TWENTY_REVIEW_TOKEN` nel container web). Inserire il nome tratto
da una fonte indipendente e il suo URL, quindi confermare. Se Twenty segnala più
corrispondenze, scegliere l'azienda CRM dalla stessa scheda.

Per eseguire i test della consegna, usare `npm test --workspace=worker`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
