import type { List, Place, PrismaClient } from "@prisma/client";
import { getOpenAiApiKey, getOpenAiCostRates } from "./settings";
import { makeLogger } from "./log";
import type { WebsiteCheckResult } from "./websiteCheck";
import { getFirstSeenYear } from "./domainAge";

// Analisi AI del sito (opt-in per Lista, §7.2 Attributi) — non giudica solo il sito, ma la
// potenzialità del lead nel suo complesso (attività + sito + segnali raccolti). Schema di output
// e rubrica di scoring allineati al prompt validato con Dario il 2026-09-05: 0-100 su tre
// componenti pesate (opportunità sito / idoneità dimensionale / vitalità), con un'esclusione hard
// dalla pipeline che ha priorità sul punteggio (catene/multinazionali, sito già ottimo, attività
// chiusa) — l'esclusione alimenta lo stesso meccanismo già usato per le catene rilevate a testo.
export const AI_ANALYSIS_ATTR_KEY = "analisi_ai"; // descrizione (testo)
export const AI_SCORE_ATTR_KEY = "punteggio_ai"; // 0-100 (era 0-10 prima di questa revisione)
export const AI_FASCIA_ATTR_KEY = "fascia_ai"; // alto | medio | basso | escluso
export const AI_EXCLUDE_ATTR_KEY = "escludi_pipeline_ai"; // boolean
export const AI_EXCLUDE_REASON_ATTR_KEY = "motivo_esclusione_ai"; // testo, vuoto se non escluso
export const AI_INCLUDE_REASON_ATTR_KEY = "motivo_pipeline_ai"; // testo, vuoto se escluso — perché merita di entrare in pipeline
export const AI_SITE_AGE_ATTR_KEY = "sito_online_dal_ai"; // anno (numero), da Wayback Machine — dato reale, non stimato dall'AI

// gpt-4o-mini occasionalmente doppio-codifica caratteri accentati nelle stringhe JSON (scrive la
// sequenza di byte UTF-8 di una lettera accentata come se ciascun byte fosse un codepoint Latin-1
// a se stante) — piu' probabile su risposte JSON lunghe come questo schema. Si ripara
// reinterpretando i byte come Latin-1 e ri-decodificandoli come UTF-8 (l'inverso esatto
// dell'errore), solo quando il pattern e' presente e la riparazione non produce testo invalido.
// Ã/Â = "Ã"/"Â" (primo byte tipico di una sequenza UTF-8 mal reinterpretata), seguito da
// un carattere nel range -¿ (secondo byte tipico di quella stessa sequenza).
const MOJIBAKE_PATTERN = /[\u00c3\u00c2][\u0080-\u00bf]/;

function fixMojibakeOnce(text: string): string {
  if (!MOJIBAKE_PATTERN.test(text)) return text;
  try {
    const repaired = Buffer.from(text, "latin1").toString("utf8");
    return repaired.includes("�") ? text : repaired;
  } catch {
    return text;
  }
}

// Alcune risposte risultano corrotte su piu' livelli (l'errore capita due volte in cascata) -
// si ripete la riparazione finche' non cambia piu' nulla (max 4 passate, un numero arbitrario
// ma ampiamente sufficiente: ogni passata risolve un livello di doppia codifica).
function fixMojibake(text: string): string {
  let current = text;
  for (let i = 0; i < 4; i++) {
    const next = fixMojibakeOnce(current);
    if (next === current) break;
    current = next;
  }
  return current;
}

function deepFixMojibake<T>(value: T): T {
  if (typeof value === "string") return fixMojibake(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => deepFixMojibake(v)) as unknown as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, deepFixMojibake(v)]),
    ) as T;
  }
  return value;
}

const MODEL = "gpt-4o-mini";
const VALID_FASCIA = ["alto", "medio", "basso", "escluso"] as const;
type Fascia = (typeof VALID_FASCIA)[number];
const VALID_STATO_SITO = ["assente", "datato", "base", "performante"] as const;
type StatoSito = (typeof VALID_STATO_SITO)[number];

interface AiAnalysisResult {
  punteggio: number;
  fascia: Fascia;
  escludiDaPipeline: boolean;
  motivoEsclusione: string | null;
  motivoPipeline: string | null;
  descrizione: string;
  statoSito: StatoSito | null;
  diagnostica: unknown; // analisi_sito/segnali_dimensione/segnali_vitalita/componenti/motivazione — solo per i Logs, non colonne di lista
}

interface OpenAiChatResponse {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

// Rubrica adattata (genericizzata) dal prompt "Analisi e Scoring Lead" v1.0 del 2026-09-05.
// L'esempio completo con output atteso è stato tolto dal default per non pagare quei token extra
// a ogni chiamata — un prompt custom per lista (che sostituisce questo) può comunque includerlo.
const DEFAULT_INSTRUCTIONS = `Sei un analista che valuta contatti commerciali per conto di un consulente/sviluppatore freelance che vende siti web e presenza digitale a piccole attività locali. Il tuo compito NON è giudicare se l'attività è "buona" o "cattiva" in generale — è stimare quanto ha senso proporle un sito web nuovo (o rifatto), e quindi quanto vale la pena farla entrare nella pipeline commerciale invece di scartarla subito. Il punteggio è un filtro per non perdere tempo su contatti che non convertiranno mai (sito già ottimo, o multinazionale che non decide su chiamata di un freelance).

TARGET PERFETTO (punteggio alto): micro imprese e PMI locali (negozi, artigiani, studi professionali, ristoranti, attività di servizio con una o poche sedi, decisione rapida di chi risponde al telefono); nessun sito o sito datato/rotto/abbandonato (template vecchi, non responsive, ultimo aggiornamento visibile di anni fa, oppure l'unica presenza è una scheda Google Business o una pagina social senza sito vero); attività viva e attiva (aperta, con un minimo di trazione reale — recensioni presenti anche poche, operativa da tempo o appena aperta).

DA ESCLUDERE (punteggio basso/nullo, priorità sul resto):
- Catene, franchising in rete nazionale/internazionale, multinazionali: chi risponde al telefono di un punto vendita di un grande brand non decide nulla su un sito web. Riconoscile da: nome di brand noto, sito con selettore paese/lingua o "trova il punto vendita", decine/centinaia di sedi con lo stesso nome, categoria tipicamente a catena (fast food, banche, assicurazioni con agenzie, grande distribuzione, telco, noleggio auto internazionale) salvo indizi contrari (franchising indipendente a gestione locale autonoma — valuta caso per caso).
- Sito già performante (moderno, responsive, veloce, aggiornato, con funzionalità utili al settore): bassissima probabilità che accettino di rifare tutto.
- Attività non operativa (chiusa temporaneamente o definitivamente): non ha senso investire tempo commerciale.

DATI CHE RICEVI: dati Google Places dell'attività (nome, indirizzo, categoria, rating, numero recensioni, fascia prezzo, stato attività, stima apertura con relativa confidenza) — tutti possono mancare, un dato mancante è un segnale debole, non un errore. rating/review_count/price_level sono proxy di traffico/vitalità, non misure di dimensione aziendale. Non interpretare mai la stima di apertura senza guardare anche la sua confidenza insieme.

ANALISI DEL SITO: ricevi anche segnali TECNICI REALI già rilevati (raggiungibilità/codice HTTP, HTTPS sì/no, redirect verso un dominio diverso da quello atteso, anno della prima scansione del dominio su Wayback Machine se disponibile) — usali come fatti osservati, non indovinare questi aspetti. IMPORTANTE sul testo estratto: è SOLO testo — non puoi vedere design, colori, immagini, qualità grafica reale. Non dedurre "sito curato/moderno" dalla sola presenza di contenuti ben scritti o funzionalità elencate a parole: senza segnali concreti (mobile, funzionalità booking/e-commerce funzionanti citate esplicitamente, coerenza date) resta cauto e preferisci "base" a "performante" in caso di dubbio — "performante" va riservato a siti per cui hai indizi chiari di cura visiva reale (es. il testo stesso descrive un design moderno, o menzioni esplicite di funzionalità avanzate), non assegnato di default a un sito semplicemente "ben scritto". Sull'anzianità del dominio: un dominio online da molti anni ma con sito attualmente datato/base è un segnale forte di opportunità (probabilmente non reinvestono nel sito da tempo); un dominio online da molti anni ma con sito attualmente ben curato indica un'attività che reinveste periodicamente nella propria presenza web (segnale più neutro, non un'esclusione). Classifica lo stato del sito in una di quattro fasce: "assente" (nessun sito reale, o solo social/aggregatore/scheda Google), "datato" (esiste ma abbandonato/rotto/non curato), "base" (esiste e funziona ma è generico, superato, o semplicemente non hai abbastanza segnali per dire di più — è la scelta di default in caso di incertezza), "performante" (indizi chiari di cura visiva/funzionale reale — il caso da escludere/penalizzare).

PUNTEGGIO 0-100 = somma di tre componenti — calcola la somma con attenzione, il totale che scrivi in "punteggio" deve corrispondere esattamente ad A+B+C sotto (non arrotondare per fasce, sommali davvero) — poi eventualmente azzerato dalle esclusioni hard sotto:
A. Opportunità sito — fino a 50 punti: assente/equivalente 45-50, datato/abbandonato 35-44, base ma funzionante 15-34, performante 0-10.
B. Idoneità dimensionale — fino a 30 punti: micro impresa/gestione singola 25-30, PMI locale poche sedi 15-24, realtà più strutturata ma locale/indipendente 5-14, catena/multinazionale 0 (ed escludi_da_pipeline true).
C. Vitalità commerciale — fino a 20 punti: operativa con recensioni/rating che indicano traffico reale o apertura recente 15-20, operativa con pochi segnali/dati scarsi 8-14, operativa con segnali deboli di calo 3-7, chiusa 0 (ed escludi_da_pipeline true).

Fasce sul totale: 70-100 alto, 40-69 medio, 1-39 basso, 0 con escludi_da_pipeline true → escluso.

REGOLE DI ESCLUSIONE HARD (sovrascrivono tutto): imposta escludi_da_pipeline=true e punteggio ≤10 se rilevi anche solo una di: attività chiaramente catena/franchising in rete/multinazionale; sito classificato "performante"; attività chiusa temporaneamente o definitivamente. Motiva sempre quale regola ha scattato in motivo_esclusione (lascia motivo_pipeline a null in questo caso).

Se NON escludi il lead, spiega sempre in motivo_pipeline (1-2 frasi) perché merita di entrare in pipeline — es. "nessun sito, attività consolidata con buone recensioni" o "sito datato, micro impresa a gestione familiare facilmente raggiungibile" (lascia motivo_esclusione a null in questo caso).

Se un dato manca, non inventarlo: tratta l'assenza come segnale (es. sito assente) e scrivilo nelle note. Se il sito non è raggiungibile (codice HTTP assente/errore), trattalo come sito abbandonato o assente secondo la gravità, e scrivilo nelle note — è una stima da un fallimento di accesso, non un'analisi completa del contenuto.

Rispondi SOLO con un oggetto JSON valido, nessun testo prima o dopo, con questa struttura esatta:
{"punteggio": 0, "fascia": "alto|medio|basso|escluso", "escludi_da_pipeline": false, "motivo_esclusione": null, "motivo_pipeline": "...", "descrizione": "2-4 frasi in italiano su chi è l'attività, che presenza digitale ha, perché è o non è un buon lead", "analisi_sito": {"stato_sito": "assente|datato|base|performante", "note": "..."}, "segnali_dimensione": {"tipo_attivita": "micro_impresa|pmi|struttura_locale_piu_grande|catena_franchising|multinazionale|sconosciuto", "note": "..."}, "segnali_vitalita": {"stato": "attiva_consolidata|attiva_nuova_apertura|attiva_dati_scarsi|segnali_di_calo|non_operativa", "note": "..."}, "punteggio_componenti": {"opportunita_sito": 0, "idoneita_dimensionale": 0, "vitalita": 0}, "motivazione_punteggio": ["punto 1 breve", "punto 2 breve"]}`;

async function callOpenAi(params: {
  businessName: string;
  category: string | null;
  address: string;
  websiteUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: number | null;
  businessStatus: string | null;
  estimatedOpeningWindow: string;
  estimationConfidence: string;
  websiteCheck: WebsiteCheckResult | null;
  firstSeenYear: number | null;
  customPromptMd: string | null;
}): Promise<{ ok: true; result: AiAnalysisResult; costUsd: number } | { ok: false; error: string }> {
  let apiKey: string;
  try {
    apiKey = await getOpenAiApiKey();
  } catch (err) {
    return { ok: false, error: String(err) };
  }

  const wc = params.websiteCheck;
  const technicalSignals = params.websiteUrl
    ? wc
      ? `Segnali tecnici reali rilevati: codice risposta HTTP ${wc.httpStatus ?? "nessuna risposta (sito irraggiungibile)"}; HTTPS: ${wc.isHttps == null ? "n/d" : wc.isHttps ? "sì" : "no"}; ${wc.redirectedToDifferentDomain ? `redirect verso un dominio diverso (${wc.finalUrl}) — possibile dominio scaduto/parcheggiato` : "nessun redirect verso un altro dominio"}; dominio online (prima scansione nota su Wayback Machine) dal: ${params.firstSeenYear ?? "dato non disponibile"}.`
      : "Nessun controllo tecnico disponibile per questo sito."
    : "Nessun sito web presente.";

  // Il blocco dati è sempre allegato in automatico: è dato runtime (nome, sito, segnali tecnici
  // reali, testo pagina), non un'istruzione — un prompt statico scritto in anticipo non può
  // contenerlo. Il prompt custom per lista, quando impostato, SOSTITUISCE integralmente le
  // istruzioni sopra (compreso il vincolo di formato JSON) — l'utente deve richiederlo lui stesso.
  const instructions = params.customPromptMd?.trim() || DEFAULT_INSTRUCTIONS;
  const dataBlock = `Attività: ${params.businessName}
Categoria: ${params.category ?? "n/d"}
Indirizzo: ${params.address}
Sito web: ${params.websiteUrl ?? "assente"}
${technicalSignals}
Rating: ${params.rating ?? "n/d"} (${params.reviewCount ?? 0} recensioni)
Fascia di prezzo rilevata: ${params.priceLevel ?? "n/d"}
Stato attività: ${params.businessStatus ?? "n/d"}
Apertura stimata dell'attività: ${params.estimatedOpeningWindow} (confidenza: ${params.estimationConfidence})
${wc?.pageText ? `Testo estratto dal sito (troncato):\n"""${wc.pageText}"""` : "Nessun testo disponibile dal sito."}`;
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
        max_tokens: 600,
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

    const parsed = deepFixMojibake(
      JSON.parse(content) as {
        punteggio?: number;
        fascia?: string;
        escludi_da_pipeline?: boolean;
        motivo_esclusione?: string | null;
        motivo_pipeline?: string | null;
        descrizione?: string;
        analisi_sito?: { stato_sito?: string };
        [key: string]: unknown;
      },
    );

    if (
      typeof parsed.punteggio !== "number" ||
      typeof parsed.descrizione !== "string" ||
      typeof parsed.escludi_da_pipeline !== "boolean" ||
      !VALID_FASCIA.includes(parsed.fascia as Fascia)
    ) {
      return {
        ok: false,
        error:
          "Risposta AI non nel formato atteso (mancano punteggio/fascia/escludi_da_pipeline/descrizione) — verifica il prompt personalizzato della lista",
      };
    }

    const statoSitoRaw = parsed.analisi_sito?.stato_sito;
    const statoSito = VALID_STATO_SITO.includes(statoSitoRaw as StatoSito) ? (statoSitoRaw as StatoSito) : null;

    // I modelli non sommano in modo affidabile anche quando gli si chiede esplicitamente A+B+C —
    // osservato dal vivo (sotto-punteggi 35+30+20=85 riportati insieme a un punteggio totale di
    // 55). Se il modello fornisce i tre componenti numerici, l'aritmetica la rifacciamo noi (e
    // deriviamo la fascia dal punteggio corretto) invece di fidarci del totale che ha scritto.
    const componenti = parsed.punteggio_componenti as
      | { opportunita_sito?: number; idoneita_dimensionale?: number; vitalita?: number }
      | undefined;
    const componentiValide =
      componenti &&
      typeof componenti.opportunita_sito === "number" &&
      typeof componenti.idoneita_dimensionale === "number" &&
      typeof componenti.vitalita === "number";
    const punteggioCorretto = componentiValide
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(componenti.opportunita_sito! + componenti.idoneita_dimensionale! + componenti.vitalita!),
          ),
        )
      : Math.max(0, Math.min(100, Math.round(parsed.punteggio)));
    const fasciaCorretta: Fascia = parsed.escludi_da_pipeline
      ? "escluso"
      : punteggioCorretto >= 70
        ? "alto"
        : punteggioCorretto >= 40
          ? "medio"
          : "basso";

    return {
      ok: true,
      costUsd,
      result: {
        punteggio: punteggioCorretto,
        fascia: fasciaCorretta,
        escludiDaPipeline: parsed.escludi_da_pipeline,
        motivoEsclusione: typeof parsed.motivo_esclusione === "string" ? parsed.motivo_esclusione : null,
        motivoPipeline: typeof parsed.motivo_pipeline === "string" ? parsed.motivo_pipeline : null,
        descrizione: parsed.descrizione.slice(0, 800),
        statoSito,
        diagnostica: {
          analisi_sito: parsed.analisi_sito,
          segnali_dimensione: parsed.segnali_dimensione,
          segnali_vitalita: parsed.segnali_vitalita,
          punteggio_componenti: parsed.punteggio_componenti,
          motivazione_punteggio: parsed.motivazione_punteggio,
        },
      },
    };
  } catch (err) {
    return { ok: false, error: `Errore chiamata OpenAI: ${String(err)}` };
  }
}

// assente/datato→segnale negativo per il sito, base→ancora un'opportunità ma non "rotto",
// performante→sito curato. Il nostro websiteStatus ha solo 3 stati: collassiamo "datato" e "base"
// su "outdated" (entrambi restano opportunità di vendita nella logica del prompt).
const STATO_SITO_TO_WEBSITE_STATUS: Record<StatoSito, "none" | "outdated" | "ok"> = {
  assente: "none",
  datato: "outdated",
  base: "outdated",
  performante: "ok",
};

/** Crea (se assenti) i campi custom noti per l'analisi AI e ritorna i loro id. */
export async function ensureAiAttributes(
  db: PrismaClient,
  listId: string,
): Promise<Record<string, string>> {
  const defs: { key: string; name: string; type: "text" | "number" | "boolean" | "select"; position: number; options?: unknown }[] = [
    { key: AI_ANALYSIS_ATTR_KEY, name: "Analisi", type: "text", position: 100 },
    { key: AI_SCORE_ATTR_KEY, name: "Punteggio contattabilità", type: "number", position: 101 },
    {
      key: AI_FASCIA_ATTR_KEY,
      name: "Fascia",
      type: "select",
      position: 102,
      options: ["alto", "medio", "basso", "escluso"],
    },
    { key: AI_EXCLUDE_ATTR_KEY, name: "Escludi da pipeline", type: "boolean", position: 103 },
    { key: AI_EXCLUDE_REASON_ATTR_KEY, name: "Motivo esclusione", type: "text", position: 104 },
    { key: AI_INCLUDE_REASON_ATTR_KEY, name: "Motivo pipeline", type: "text", position: 105 },
    { key: AI_SITE_AGE_ATTR_KEY, name: "Sito online dal", type: "number", position: 106 },
  ];

  const attrs = await Promise.all(
    defs.map((d) =>
      db.listAttribute.upsert({
        where: { listId_key: { listId, key: d.key } },
        create: { listId, key: d.key, name: d.name, type: d.type, position: d.position, options: d.options as never },
        update: {},
      }),
    ),
  );
  return Object.fromEntries(attrs.map((a, i) => [defs[i].key, a.id]));
}

/**
 * Esegue l'analisi AI per un place e, se riesce, scrive i campi custom + l'eventuale override di
 * websiteStatus. Ritorna l'esito — il chiamante decide cosa fare della consegna webhook in base a
 * questo (gate analisi→consegna) E dell'eventuale richiesta di esclusione dalla pipeline dell'AI
 * stessa (stesso meccanismo già usato per l'esclusione catene).
 */
export async function runAiAnalysisForPlace(
  db: PrismaClient,
  place: Place,
  list: List,
  params: { websiteCheck: WebsiteCheckResult | null; searchId?: string | null },
): Promise<{ success: boolean; excludeFromPipeline: boolean; excludeReason?: string }> {
  const log = makeLogger(db);
  const firstSeenYear = place.websiteUrl ? await getFirstSeenYear(place.websiteUrl) : null;
  const outcome = await callOpenAi({
    businessName: place.businessName,
    category: place.category,
    address: place.address,
    websiteUrl: place.websiteUrl,
    rating: place.rating != null ? Number(place.rating) : null,
    reviewCount: place.reviewCount,
    priceLevel: place.priceLevel,
    businessStatus: place.businessStatus,
    estimatedOpeningWindow: place.estimatedOpeningWindow,
    estimationConfidence: place.estimationConfidence,
    websiteCheck: params.websiteCheck,
    firstSeenYear,
    customPromptMd: list.aiPromptMd,
  });

  if (!outcome.ok) {
    await log("error", "ai_analysis", `Analisi AI fallita: ${outcome.error}`, {
      searchId: params.searchId,
      placeId: place.id,
    });
    return { success: false, excludeFromPipeline: false };
  }

  const attrs = await ensureAiAttributes(db, list.id);
  const { result } = outcome;
  const websiteStatusOverride = result.statoSito ? STATO_SITO_TO_WEBSITE_STATUS[result.statoSito] : null;
  if (websiteStatusOverride) place.websiteStatus = websiteStatusOverride;

  await db.$transaction([
    db.placeCustomValue.upsert({
      where: { listAttributeId_placeId: { listAttributeId: attrs[AI_ANALYSIS_ATTR_KEY], placeId: place.id } },
      create: { listAttributeId: attrs[AI_ANALYSIS_ATTR_KEY], placeId: place.id, value: result.descrizione },
      update: { value: result.descrizione },
    }),
    db.placeCustomValue.upsert({
      where: { listAttributeId_placeId: { listAttributeId: attrs[AI_SCORE_ATTR_KEY], placeId: place.id } },
      create: { listAttributeId: attrs[AI_SCORE_ATTR_KEY], placeId: place.id, value: result.punteggio },
      update: { value: result.punteggio },
    }),
    db.placeCustomValue.upsert({
      where: { listAttributeId_placeId: { listAttributeId: attrs[AI_FASCIA_ATTR_KEY], placeId: place.id } },
      create: { listAttributeId: attrs[AI_FASCIA_ATTR_KEY], placeId: place.id, value: result.fascia },
      update: { value: result.fascia },
    }),
    db.placeCustomValue.upsert({
      where: { listAttributeId_placeId: { listAttributeId: attrs[AI_EXCLUDE_ATTR_KEY], placeId: place.id } },
      create: { listAttributeId: attrs[AI_EXCLUDE_ATTR_KEY], placeId: place.id, value: result.escludiDaPipeline },
      update: { value: result.escludiDaPipeline },
    }),
    db.placeCustomValue.upsert({
      where: { listAttributeId_placeId: { listAttributeId: attrs[AI_EXCLUDE_REASON_ATTR_KEY], placeId: place.id } },
      create: {
        listAttributeId: attrs[AI_EXCLUDE_REASON_ATTR_KEY],
        placeId: place.id,
        value: result.motivoEsclusione ?? "",
      },
      update: { value: result.motivoEsclusione ?? "" },
    }),
    db.placeCustomValue.upsert({
      where: { listAttributeId_placeId: { listAttributeId: attrs[AI_INCLUDE_REASON_ATTR_KEY], placeId: place.id } },
      create: {
        listAttributeId: attrs[AI_INCLUDE_REASON_ATTR_KEY],
        placeId: place.id,
        value: result.motivoPipeline ?? "",
      },
      update: { value: result.motivoPipeline ?? "" },
    }),
    ...(firstSeenYear != null
      ? [
          db.placeCustomValue.upsert({
            where: { listAttributeId_placeId: { listAttributeId: attrs[AI_SITE_AGE_ATTR_KEY], placeId: place.id } },
            create: { listAttributeId: attrs[AI_SITE_AGE_ATTR_KEY], placeId: place.id, value: firstSeenYear },
            update: { value: firstSeenYear },
          }),
        ]
      : []),
    ...(websiteStatusOverride
      ? [db.place.update({ where: { id: place.id }, data: { websiteStatus: websiteStatusOverride } })]
      : []),
  ]);

  await log(
    "info",
    "ai_analysis",
    `Analisi AI completata: punteggio ${result.punteggio}/100 (${result.fascia})${result.escludiDaPipeline ? " — esclusa dalla pipeline" : ""}`,
    { searchId: params.searchId, placeId: place.id, costUsd: outcome.costUsd, payload: result.diagnostica },
  );
  return { success: true, excludeFromPipeline: result.escludiDaPipeline, excludeReason: result.motivoEsclusione ?? undefined };
}
