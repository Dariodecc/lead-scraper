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
  // Segnali tecnici REALI (non testo, non un'inferenza del modello) — passati all'analisi AI così
  // "raggiungibilità"/HTTPS/redirect a dominio parcheggiato sono dati osservati, non indovinati
  // da un modello che non può davvero "visitare" nulla (vede solo il testo estratto sotto).
  httpStatus: number | null; // null = richiesta fallita del tutto (DNS, timeout, connessione rifiutata)
  isHttps: boolean | null;
  finalUrl: string | null; // dopo eventuali redirect
  redirectedToDifferentDomain: boolean | null; // es. dominio scaduto parcheggiato altrove
}

const MAX_PAGE_TEXT_CHARS = 4000;

function sameDomain(a: string, b: string): boolean {
  try {
    const norm = (h: string) => h.replace(/^www\./, "");
    return norm(new URL(a).hostname) === norm(new URL(b).hostname);
  } catch {
    return true; // URL non parsabile: non azzardare un falso "redirect sospetto"
  }
}

export async function checkWebsiteStatus(url: string): Promise<WebsiteCheckResult> {
  const failed: WebsiteCheckResult = {
    status: "outdated",
    pageText: null,
    httpStatus: null,
    isHttps: null,
    finalUrl: null,
    redirectedToDifferentDomain: null,
  };

  let browser: Browser;
  try {
    browser = await getBrowser();
  } catch (err) {
    console.error("checkWebsiteStatus: impossibile avviare il browser:", err);
    return failed;
  }

  const page = await browser.newPage();
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    const finalUrl = page.url();
    const httpStatus = response?.status() ?? null;
    const isHttps = finalUrl.startsWith("https://");
    const redirectedToDifferentDomain = !sameDomain(url, finalUrl);

    if (!response || !response.ok()) {
      return { ...failed, httpStatus, isHttps, finalUrl, redirectedToDifferentDomain };
    }

    const hasViewportMeta = await page.locator('meta[name="viewport"]').count();
    const pageText = await page
      .evaluate(() => document.body?.innerText ?? "")
      .then((t) => t.replace(/\s+/g, " ").trim().slice(0, MAX_PAGE_TEXT_CHARS))
      .catch(() => null);

    return {
      status: hasViewportMeta > 0 ? "ok" : "outdated",
      pageText,
      httpStatus,
      isHttps,
      finalUrl,
      redirectedToDifferentDomain,
    };
  } catch (err) {
    console.error(`checkWebsiteStatus: errore caricando ${url}:`, err);
    return failed;
  } finally {
    await page.close();
  }
}
