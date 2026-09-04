import { getOpenAiApiKey } from "./settings";

// Analisi AI del sito (opt-in per Lista, §7.2 Attributi) — non giudica solo il sito, ma la
// potenzialità del lead nel suo complesso (attività + sito + segnali raccolti). Scrive tre cose:
// una breve descrizione, uno scoring 0-10 di contattabilità, e la sua stessa valutazione dello
// stato del sito — quest'ultima sostituisce l'euristica Playwright (solo meta viewport) quando
// l'AI è attiva, perché ha il testo vero della pagina ed è meno soggetta a falsi positivi sui
// siti con protezioni anti-bot (es. grandi catene bloccano Chromium headless, l'euristica vede
// una pagina di blocco e segna "datato" a torto).
export const AI_ANALYSIS_ATTR_KEY = "analisi_ai";
export const AI_SCORE_ATTR_KEY = "punteggio_ai";

const MODEL = "gpt-4o-mini";
const VALID_WEBSITE_STATUS = ["none", "outdated", "ok"] as const;
type WebsiteStatusValue = (typeof VALID_WEBSITE_STATUS)[number];

export interface AiAnalysisResult {
  analysis: string;
  score: number;
  websiteStatus: WebsiteStatusValue | null;
}

interface OpenAiChatResponse {
  choices?: { message?: { content?: string } }[];
}

/**
 * `pageText` può essere null (sito assente/non caricato/bloccato) — in quel caso l'AI valuta sui
 * soli metadati dell'attività, segnalandolo nell'analisi invece di indovinare lo stato del sito.
 */
export async function analyzeWebsite(params: {
  businessName: string;
  category: string | null;
  websiteUrl: string | null;
  heuristicWebsiteStatus: string;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: number | null;
  estimatedOpeningWindow: string;
  estimationConfidence: string;
  pageText: string | null;
}): Promise<AiAnalysisResult | null> {
  let apiKey: string;
  try {
    apiKey = await getOpenAiApiKey();
  } catch {
    return null; // chiave non configurata — analisi AI silenziosamente disabilitata
  }

  const prompt = `Sei un analista che aiuta un'agenzia di siti web/marketing a decidere quali attività locali contattare come potenziali clienti. Il tuo giudizio non riguarda solo il sito: valuta la potenzialità complessiva del lead, combinando sito, reputazione e segnali di quanto l'attività sia giovane/attiva.

Attività: ${params.businessName}
Categoria: ${params.category ?? "n/d"}
Sito web: ${params.websiteUrl ?? "assente"}
Stato sito rilevato da un controllo automatico (solo presenza tag viewport, può sbagliare — es. su siti con protezioni anti-bot): ${params.heuristicWebsiteStatus}
Rating: ${params.rating ?? "n/d"} (${params.reviewCount ?? 0} recensioni)
Fascia di prezzo rilevata: ${params.priceLevel ?? "n/d"}
Apertura stimata dell'attività: ${params.estimatedOpeningWindow} (confidenza: ${params.estimationConfidence})
${params.pageText ? `Testo estratto dal sito (troncato):\n"""${params.pageText}"""` : "Nessun testo disponibile dal sito (assente, non caricato, o bloccato da una protezione anti-bot — non dedurre che il sito sia per forza vecchio solo per questo, dillo esplicitamente nell'analisi se è il caso)."}

Rispondi SOLO con un oggetto JSON valido con questi campi:
- "website_status": la TUA valutazione dello stato del sito, uno tra "none" (nessun sito), "outdated" (sito vecchio/trascurato/non responsive), "ok" (sito curato e aggiornato) — se non hai testo sufficiente per giudicare, usa il tuo giudizio migliore ma resta cauto nell'analisi
- "analysis": una brevissima analisi in italiano (massimo 2 frasi) su quanto il sito sembra curato E quanto l'attività nel suo complesso sembra un buon lead da contattare
- "score": punteggio "contattabilità" da 0 a 10 (10 = priorità massima, es. sito assente/datato ma attività con buona reputazione o appena aperta; 0 = non contattare, es. sito già ottimo o attività poco attiva/chiusa)

Formato: {"website_status": "...", "analysis": "...", "score": 0}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 250,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      console.error(`analyzeWebsite: OpenAI ${res.status} ${await res.text()}`);
      return null;
    }
    const data = (await res.json()) as OpenAiChatResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as {
      analysis?: string;
      score?: number;
      website_status?: string;
    };
    if (typeof parsed.analysis !== "string" || typeof parsed.score !== "number") return null;

    const websiteStatus = VALID_WEBSITE_STATUS.includes(parsed.website_status as WebsiteStatusValue)
      ? (parsed.website_status as WebsiteStatusValue)
      : null;

    return {
      analysis: parsed.analysis.slice(0, 500),
      score: Math.max(0, Math.min(10, Math.round(parsed.score))),
      websiteStatus,
    };
  } catch (err) {
    console.error("analyzeWebsite: errore chiamata OpenAI:", err);
    return null;
  }
}
