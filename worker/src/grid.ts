// Copertura a griglia per aree ampie (§1 feedback utente, §12 nota aperta sui limiti di raggio).
// Nearby Search (New) restituisce al massimo 20 risultati per chiamata e NON supporta paginazione
// (limite reale dell'API, verificato in produzione — una singola chiamata su un raggio cittadino
// tronca silenziosamente i risultati oltre i primi 20). Per coprire un'area ampia (es. "tutta
// Bari") si divide il raggio richiesto in una griglia di celle più piccole, si interroga Google
// separatamente per ciascuna, e si deduplica per place_id (il dedup esistente nel processor lo fa
// già automaticamente, incluso tra celle della stessa run).

export interface GridCell {
  lat: number;
  lng: number;
}

const METERS_PER_DEGREE_LAT = 111_320;

/**
 * Genera i centri delle celle che coprono un cerchio di raggio `totalRadiusM` centrato su
 * (centerLat, centerLng), ciascuna di raggio `cellRadiusM`. Le celle si sovrappongono
 * leggermente (spaziatura 1.5x il raggio cella) per non lasciare buchi ai bordi. Se il totale
 * supera `maxCells`, si tengono le celle più vicine al centro (cuore della città prioritario) e
 * si tronca il resto — meglio una copertura parziale dichiarata che un costo di quota illimitato.
 */
export function generateGrid(
  centerLat: number,
  centerLng: number,
  totalRadiusM: number,
  cellRadiusM: number,
  maxCells: number,
): { cells: GridCell[]; truncated: boolean } {
  if (totalRadiusM <= cellRadiusM) {
    return { cells: [{ lat: centerLat, lng: centerLng }], truncated: false };
  }

  const spacingM = cellRadiusM * 1.5;
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos((centerLat * Math.PI) / 180);
  const steps = Math.ceil(totalRadiusM / spacingM);

  const candidates: (GridCell & { distM: number })[] = [];
  for (let i = -steps; i <= steps; i++) {
    for (let j = -steps; j <= steps; j++) {
      const dx = i * spacingM;
      const dy = j * spacingM;
      const distM = Math.sqrt(dx * dx + dy * dy);
      if (distM > totalRadiusM) continue;
      candidates.push({
        lat: centerLat + dy / METERS_PER_DEGREE_LAT,
        lng: centerLng + dx / metersPerDegreeLng,
        distM,
      });
    }
  }

  candidates.sort((a, b) => a.distM - b.distM);
  const truncated = candidates.length > maxCells;
  return {
    cells: candidates.slice(0, maxCells).map(({ lat, lng }) => ({ lat, lng })),
    truncated,
  };
}
