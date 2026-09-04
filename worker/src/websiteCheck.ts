import { chromium, type Browser } from "playwright";

// Verifica stato del sito web dichiarato (§4: "verifica presenza e stato del sito web").
// Euristica semplice e dichiarata come tale: un sito che non carica o non ha una meta viewport
// (quindi quasi certamente non responsive) è "datato" — non è un giudizio di qualità, solo un
// proxy grezzo per "sito probabilmente abbandonato/vecchio" vs "sito mantenuto". I grandi brand
// con protezioni anti-bot (Cloudflare/Akamai) possono risultare falsamente "datato" se la pagina
// servita al browser headless è una schermata di blocco invece del sito vero — limite noto.
//
// --no-sandbox è necessario perché il container gira come root (Chromium rifiuta il proprio
// sandbox in quelle condizioni) — senza, chromium.launch() falliva sempre e ogni sito veniva
// etichettato "datato" a prescindere, mascherato dal catch generico sotto.

let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium
      .launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] })
      .catch((err) => {
        browserPromise = null; // permette un nuovo tentativo alla prossima chiamata
        throw err;
      });
  }
  return browserPromise;
}

export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    try {
      const browser = await browserPromise;
      await browser.close();
    } catch {
      // già fallito/chiuso, niente da fare
    }
    browserPromise = null;
  }
}

export interface WebsiteCheckResult {
  status: "outdated" | "ok";
  // Testo visibile della pagina, troncato — riusato per l'analisi AI (evita di ricaricare il
  // sito una seconda volta). Assente se il caricamento è fallito.
  pageText: string | null;
}

const MAX_PAGE_TEXT_CHARS = 4000;

export async function checkWebsiteStatus(url: string): Promise<WebsiteCheckResult> {
  let browser: Browser;
  try {
    browser = await getBrowser();
  } catch (err) {
    console.error("checkWebsiteStatus: impossibile avviare il browser:", err);
    return { status: "outdated", pageText: null };
  }

  const page = await browser.newPage();
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    if (!response || !response.ok()) return { status: "outdated", pageText: null };

    const hasViewportMeta = await page.locator('meta[name="viewport"]').count();
    const pageText = await page
      .evaluate(() => document.body?.innerText ?? "")
      .then((t) => t.replace(/\s+/g, " ").trim().slice(0, MAX_PAGE_TEXT_CHARS))
      .catch(() => null);

    return { status: hasViewportMeta > 0 ? "ok" : "outdated", pageText };
  } catch (err) {
    console.error(`checkWebsiteStatus: errore caricando ${url}:`, err);
    return { status: "outdated", pageText: null };
  } finally {
    await page.close();
  }
}
