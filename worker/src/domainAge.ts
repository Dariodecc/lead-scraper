// Anzianità del sito — dato REALE e gratuito (nessuna chiave richiesta) dalla Wayback Machine di
// Internet Archive, non un'inferenza del modello. Chiedendo lo snapshot più vicino a una data
// remota (1996, prima che il web commerciale esistesse) l'API restituisce di fatto la prima
// scansione disponibile per quel dominio — un proxy ragionevole di "da quanto tempo esiste il
// sito", anche se non del "quando è stato fatto il design attuale" (il dominio può essere stato
// ridisegnato più volte da allora — l'analisi AI la tratta come indizio di presenza web, non come
// prova di un design vecchio).
export async function getFirstSeenYear(url: string): Promise<number | null> {
  try {
    const hostname = new URL(url).hostname;
    const res = await fetch(
      `https://archive.org/wayback/available?url=${encodeURIComponent(hostname)}&timestamp=19960101`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      archived_snapshots?: { closest?: { timestamp?: string; available?: boolean } };
    };
    const snapshot = data.archived_snapshots?.closest;
    if (!snapshot?.available || !snapshot.timestamp || snapshot.timestamp.length < 4) return null;
    const year = Number(snapshot.timestamp.slice(0, 4));
    return Number.isFinite(year) ? year : null;
  } catch {
    return null; // servizio esterno non raggiungibile: il dato resta assente, mai indovinato
  }
}
