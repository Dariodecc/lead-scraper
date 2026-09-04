import { getOpenAiApiKey } from "./settings";

// Analisi AI del sito (opt-in per Lista, §7.2 Attributi) — una breve descrizione + uno scoring
// 0-10 di "quanto vale la pena contattare questa attività", scritti nei due campi custom ben
// noti "analisi_ai"/"punteggio_ai" (creati automaticamente sulla lista se assenti).
export const AI_ANALYSIS_ATTR_KEY = "analisi_ai";
export const AI_SCORE_ATTR_KEY = "punteggio_ai";

const MODEL = "gpt-4o-mini";

export interface AiAnalysisResult {
  analysis: string;
  score: number;
}

interface OpenAiChatResponse {
  choices?: { message?: { content?: string } }[];
}

/**
 * `pageText` può essere null (sito assente/non caricato) — in quel caso l'AI valuta solo sui
 * metadati dell'attività (categoria, rating, stato sito), utile comunque per uno scoring di
 * base ("nessun sito" è di per sé un segnale forte per un servizio di siti web).
 */
export async function analyzeWebsite(params: {
  businessName: string;
  category: string | null;
  websiteUrl: string | null;
  websiteStatus: string;
  rating: number | null;
  reviewCount: number | null;
  pageText: string | null;
}): Promise<AiAnalysisResult | null> {
  let apiKey: string;
  try {
    apiKey = await getOpenAiApiKey();
  } catch {
    return null; // chiave non configurata — analisi AI silenziosamente disabilitata
  }

  const prompt = `Sei un analista che aiuta un'agenzia di siti web/marketing a decidere quali attività locali contattare come potenziali clienti.

Attività: ${params.businessName}
Categoria: ${params.category ?? "n/d"}
Sito web: ${params.websiteUrl ?? "assente"}
Stato sito rilevato: ${params.websiteStatus}
Rating: ${params.rating ?? "n/d"} (${params.reviewCount ?? 0} recensioni)
${params.pageText ? `Testo estratto dal sito (troncato):\n"""${params.pageText}"""` : "Nessun testo disponibile (sito assente o non caricato)."}

Scrivi una brevissima analisi (massimo 2 frasi, in italiano) su quanto questo sito sembra curato/aggiornato e quanto l'attività sembra un buon potenziale cliente per servizi di sito web/marketing. Poi assegna un punteggio "contattabilità" da 0 a 10 (10 = priorità massima da contattare, es. sito assente o molto datato ma attività con buona reputazione; 0 = non contattare, es. sito già ottimo o attività poco attiva).

Rispondi SOLO con un oggetto JSON valido nel formato: {"analysis": "...", "score": 0}`;

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
        max_tokens: 200,
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

    const parsed = JSON.parse(content) as { analysis?: string; score?: number };
    if (typeof parsed.analysis !== "string" || typeof parsed.score !== "number") return null;

    return {
      analysis: parsed.analysis.slice(0, 500),
      score: Math.max(0, Math.min(10, Math.round(parsed.score))),
    };
  } catch (err) {
    console.error("analyzeWebsite: errore chiamata OpenAI:", err);
    return null;
  }
}
