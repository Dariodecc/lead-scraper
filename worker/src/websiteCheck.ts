import { chromium, type Browser } from "playwright";

// Verifica stato del sito web dichiarato (§4: "verifica presenza e stato del sito web").
// Euristica semplice e dichiarata come tale: un sito che non carica o non ha una meta viewport
// (quindi quasi certamente non responsive) è "datato" — non è un giudizio di qualità, solo un
// proxy grezzo per "sito probabilmente abbandonato/vecchio" vs "sito mantenuto".

let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true });
  }
  return browserPromise;
}

export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
    browserPromise = null;
  }
}

export async function checkWebsiteStatus(url: string): Promise<"outdated" | "ok"> {
  let browser: Browser;
  try {
    browser = await getBrowser();
  } catch {
    return "outdated";
  }

  const page = await browser.newPage();
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    if (!response || !response.ok()) return "outdated";
    const hasViewportMeta = await page.locator('meta[name="viewport"]').count();
    return hasViewportMeta > 0 ? "ok" : "outdated";
  } catch {
    return "outdated";
  } finally {
    await page.close();
  }
}
