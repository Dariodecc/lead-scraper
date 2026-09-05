import type { List, Place, PrismaClient } from "@prisma/client";
import { getOpenAiApiKey, getOpenAiCostRates } from "./settings";
import { makeLogger } from "./log";

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

interface AiAnalysisResult {
  analysis: string;
  score: number;
  websiteStatus: WebsiteStatusValue | null;
}

interface OpenAiChatResponse {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

const DEFAULT_INSTRUCTIONS = `Sei un analista che aiuta un'agenzia di siti web/marketing a decidere quali attività locali contattare come potenziali clienti. Il tuo giudizio non riguarda solo il sito: valuta la potenzialità complessiva del lead, combinando sito, reputazione e segnali di quanto l'attività sia giovane/attiva.

Rispondi SOLO con un oggetto JSON valido con questi campi:
- "website_status": la TUA valutazione dello stato del sito, uno tra "none" (nessun sito), "outdated" (sito vecchio/trascurato/non responsive), "ok" (sito curato e aggiornato) — se non hai testo sufficiente per giudicare, usa il tuo giudizio migliore ma resta cauto nell'analisi
- "analysis": una brevissima analisi in italiano (massimo 2 frasi) su quanto il sito sembra curato E quanto l'attività nel suo complesso sembra un buon lead da contattare
- "score": punteggio "contattabilità" da 0 a 10 (10 = priorità massima, es. sito assente/datato ma attività con buona reputazione o appena aperta; 0 = non contattare, es. sito già ottimo o attività poco attiva/chiusa)

Formato: {"website_status": "...", "analysis": "...", "score": 0}`;

async function analyzeWebsite(params: {
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
  customPromptMd: string | null;
}): Promise<{ ok: true; result: AiAnalysisResult; costUsd: number } | { ok: false; error: string }> {
  let apiKey: string;
  try {
    apiKey = await getOpenAiApiKey();
  } catch (err) {
    return { ok: false, error: String(err) };
  }

  // Il blocco dati è sempre allegato in automatico: è dato runtime (nome, sito, rating, testo
  // pagina), non un'istruzione — un prompt statico scritto in anticipo non può contenerlo. Il
  // prompt custom per lista, quando impostato, SOSTITUISCE integralmente le istruzioni sopra
  // (compreso il vincolo di formato JSON) — l'utente deve richiederlo lui stesso nel suo prompt.
  const instructions = params.customPromptMd?.trim() || DEFAULT_INSTRUCTIONS;
  const dataBlock = `Attività: ${params.businessName}
Categoria: ${params.category ?? "n/d"}
Sito web: ${params.websiteUrl ?? "assente"}
Stato sito rilevato da un controllo automatico (solo presenza tag viewport, può sbagliare — es. su siti con protezioni anti-bot): ${params.heuristicWebsiteStatus}
Rating: ${params.rating ?? "n/d"} (${params.reviewCount ?? 0} recensioni)
Fascia di prezzo rilevata: ${params.priceLevel ?? "n/d"}
Apertura stimata dell'attività: ${params.estimatedOpeningWindow} (confidenza: ${params.estimationConfidence})
${params.pageText ? `Testo estratto dal sito (troncato):\n"""${params.pageText}"""` : "Nessun testo disponibile dal sito (assente, non caricato, o bloccato da una protezione anti-bot — non dedurre che il sito sia per forza vecchio solo per questo, dillo esplicitamente nell'analisi se è il caso)."}`;
  const prompt = `${instructions}\n\n${dataBlock}`;

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
      return { ok: false, error: `OpenAI ${res.status}: ${await res.text()}` };
    }
    const data = (await res.json()) as OpenAiChatResponse;
    const { inputPer1M, outputPer1M } = await getOpenAiCostRates();
    const costUsd =
      ((data.usage?.prompt_tokens ?? 0) / 1_000_000) * inputPer1M +
      ((data.usage?.completion_tokens ?? 0) / 1_000_000) * outputPer1M;

    const content = data.choices?.[0]?.message?.content;
    if (!content) return { ok: false, error: "Risposta OpenAI senza contenuto" };

    const parsed = JSON.parse(content) as {
      analysis?: string;
      score?: number;
      website_status?: string;
    };
    if (typeof parsed.analysis !== "string" || typeof parsed.score !== "number") {
      return {
        ok: false,
        error:
          "Risposta AI non nel formato atteso (mancano analysis/score) — verifica il prompt personalizzato della lista",
      };
    }

    const websiteStatus = VALID_WEBSITE_STATUS.includes(parsed.website_status as WebsiteStatusValue)
      ? (parsed.website_status as WebsiteStatusValue)
      : null;

    return {
      ok: true,
      costUsd,
      result: {
        analysis: parsed.analysis.slice(0, 500),
        score: Math.max(0, Math.min(10, Math.round(parsed.score))),
        websiteStatus,
      },
    };
  } catch (err) {
    return { ok: false, error: `Errore chiamata OpenAI: ${String(err)}` };
  }
}

/** Crea (se assenti) i due campi custom ben noti per l'analisi AI e ritorna i loro id. */
export async function ensureAiAttributes(
  db: PrismaClient,
  listId: string,
): Promise<{ analysisAttrId: string; scoreAttrId: string }> {
  const [analysisAttr, scoreAttr] = await Promise.all([
    db.listAttribute.upsert({
      where: { listId_key: { listId, key: AI_ANALYSIS_ATTR_KEY } },
      create: { listId, key: AI_ANALYSIS_ATTR_KEY, name: "Analisi", type: "text", position: 100 },
      update: {},
    }),
    db.listAttribute.upsert({
      where: { listId_key: { listId, key: AI_SCORE_ATTR_KEY } },
      create: {
        listId,
        key: AI_SCORE_ATTR_KEY,
        name: "Punteggio contattabilità",
        type: "number",
        position: 101,
      },
      update: {},
    }),
  ]);
  return { analysisAttrId: analysisAttr.id, scoreAttrId: scoreAttr.id };
}

/**
 * Esegue l'analisi AI per un place e, se riesce, scrive i campi custom + l'eventuale override di
 * websiteStatus. Ritorna true/false — il chiamante decide cosa fare della consegna webhook in
 * base a questo esito (gate analisi→consegna, §7.2: "se l'analisi fallisce non devo procedere").
 * Logga sempre l'esito in categoria ai_analysis, cosa che prima mancava (solo console.error).
 */
export async function runAiAnalysisForPlace(
  db: PrismaClient,
  place: Place,
  list: List,
  params: { heuristicWebsiteStatus: string; pageText: string | null; searchId?: string | null },
): Promise<boolean> {
  const log = makeLogger(db);
  const outcome = await analyzeWebsite({
    businessName: place.businessName,
    category: place.category,
    websiteUrl: place.websiteUrl,
    heuristicWebsiteStatus: params.heuristicWebsiteStatus,
    rating: place.rating != null ? Number(place.rating) : null,
    reviewCount: place.reviewCount,
    priceLevel: place.priceLevel,
    estimatedOpeningWindow: place.estimatedOpeningWindow,
    estimationConfidence: place.estimationConfidence,
    pageText: params.pageText,
    customPromptMd: list.aiPromptMd,
  });

  if (!outcome.ok) {
    await log("error", "ai_analysis", `Analisi AI fallita: ${outcome.error}`, {
      searchId: params.searchId,
      placeId: place.id,
    });
    return false;
  }

  const aiAttrs = await ensureAiAttributes(db, list.id);
  const { result } = outcome;
  if (result.websiteStatus) place.websiteStatus = result.websiteStatus;

  await db.$transaction([
    db.placeCustomValue.upsert({
      where: { listAttributeId_placeId: { listAttributeId: aiAttrs.analysisAttrId, placeId: place.id } },
      create: { listAttributeId: aiAttrs.analysisAttrId, placeId: place.id, value: result.analysis },
      update: { value: result.analysis },
    }),
    db.placeCustomValue.upsert({
      where: { listAttributeId_placeId: { listAttributeId: aiAttrs.scoreAttrId, placeId: place.id } },
      create: { listAttributeId: aiAttrs.scoreAttrId, placeId: place.id, value: result.score },
      update: { value: result.score },
    }),
    ...(result.websiteStatus
      ? [db.place.update({ where: { id: place.id }, data: { websiteStatus: result.websiteStatus } })]
      : []),
  ]);

  await log("info", "ai_analysis", `Analisi AI completata: punteggio ${result.score}/10`, {
    searchId: params.searchId,
    placeId: place.id,
    costUsd: outcome.costUsd,
  });
  return true;
}
