// Tassonomia ufficiale dei Place Types (New) di Google, con etichetta italiana (§4).
// Nessun segreto qui — importabile sia da Server che da Client Component.
export const PLACE_TYPES = [
  { id: "plumber", label: "Idraulico" },
  { id: "electrician", label: "Elettricista" },
  { id: "restaurant", label: "Ristorante" },
  { id: "hair_care", label: "Parrucchiere" },
  { id: "gym", label: "Palestra" },
  { id: "dentist", label: "Studio dentistico" },
  { id: "car_repair", label: "Officina meccanica" },
  { id: "bakery", label: "Panetteria" },
  { id: "lawyer", label: "Studio legale" },
  { id: "real_estate_agency", label: "Agenzia immobiliare" },
  { id: "accounting", label: "Commercialista" },
  { id: "beauty_salon", label: "Centro estetico" },
  { id: "physiotherapist", label: "Fisioterapista" },
  { id: "insurance_agency", label: "Agenzia assicurativa" },
  { id: "painter", label: "Imbianchino" },
  { id: "roofing_contractor", label: "Impresa edile / coperture" },
  { id: "locksmith", label: "Fabbro" },
  { id: "veterinary_care", label: "Veterinario" },
  { id: "florist", label: "Fioraio" },
  { id: "pet_store", label: "Negozio animali" },
] as const;

export type PlaceTypeId = (typeof PLACE_TYPES)[number]["id"];

export function placeTypeLabel(id: string): string {
  return PLACE_TYPES.find((t) => t.id === id)?.label ?? id;
}
