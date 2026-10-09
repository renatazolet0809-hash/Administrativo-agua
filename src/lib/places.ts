// ============================================================
// Google Places — autocompletado de direcciones de clientes
// ============================================================
// Se activa automáticamente al definir GOOGLE_MAPS_API_KEY en las
// variables de entorno (local .env o Vercel → Environment Variables).
//
// Sin clave: placesEnabled() devuelve false y las rutas responden
// { enabled: false }, por lo que los formularios se comportan como
// campos de texto normales (cero cambio de comportamiento).
//
// Estrategia: se usa primero "Places API (New)" (places.googleapis.com/v1)
// y, si la clave solo tiene la API legacy habilitada, se reintenta con
// maps.googleapis.com/maps/api. Una sola clave sirve en ambos casos.
//
// Nota: la clave NUNCA llega al navegador; el cliente habla solo con
// nuestras rutas /api/places/* (proxy server-side).

const NEW_BASE = process.env.GOOGLE_PLACES_API_BASE || "https://places.googleapis.com/v1";
const LEGACY_BASE = process.env.GOOGLE_MAPS_LEGACY_BASE || "https://maps.googleapis.com/maps/api";
const LANG = "es";

export function placesEnabled(): boolean {
  return Boolean((process.env.GOOGLE_MAPS_API_KEY || "").trim());
}

export interface Suggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

export interface PlaceDetails {
  address: string;
  lat: number;
  lng: number;
  zone: string | null;
}

// ---- Límite simple de solicitudes por IP (evita abuso del proxy público) ----
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (list.length >= limit) {
    hits.set(key, list);
    return false;
  }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 1_000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= windowMs)) hits.delete(k);
    }
  }
  return true;
}

function clean(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ---- Tipos mínimos de las respuestas de Google ----
interface NewAutocompleteResponse {
  suggestions?: {
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }[];
}

interface LegacyAutocompleteResponse {
  status?: string;
  predictions?: {
    place_id?: string;
    description?: string;
    structured_formatting?: { main_text?: string; secondary_text?: string };
  }[];
}

interface NewDetailsResponse {
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  addressComponents?: { longText?: string; types?: string[] }[];
}

interface LegacyDetailsResponse {
  status?: string;
  result?: {
    formatted_address?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
    address_components?: { long_name?: string; types?: string[] }[];
  };
}

// Prioridad de componentes de dirección para inferir la zona/sector
const ZONE_TYPES = [
  "sublocality_level_1",
  "sublocality",
  "neighborhood",
  "locality",
  "administrative_area_level_2",
];

function zoneFromComponents(
  components: { longText?: string; long_name?: string; types?: string[] }[]
): string | null {
  for (const type of ZONE_TYPES) {
    const hit = components.find((c) => (c.types || []).includes(type));
    if (hit) return clean(hit.longText ?? hit.long_name);
  }
  return null;
}

// ------------------------- Autocomplete -------------------------

async function autocompleteNew(input: string, sessionToken: string): Promise<Suggestion[]> {
  const key = (process.env.GOOGLE_MAPS_API_KEY || "").trim();
  const region = (process.env.GOOGLE_PLACES_REGION || "").trim();
  const payload: Record<string, unknown> = { input, sessionToken, languageCode: LANG };
  if (region) payload.regionCode = region;

  const data = (await fetchJson(`${NEW_BASE}/places:autocomplete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
    body: JSON.stringify(payload),
  })) as NewAutocompleteResponse;

  return (data.suggestions || [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => ({
      placeId: clean(p.placeId),
      mainText: clean(p.structuredFormat?.mainText?.text) || clean(p.text?.text),
      secondaryText: clean(p.structuredFormat?.secondaryText?.text),
    }))
    .filter((s) => s.placeId && s.mainText);
}

async function autocompleteLegacy(input: string, sessionToken: string): Promise<Suggestion[]> {
  const key = (process.env.GOOGLE_MAPS_API_KEY || "").trim();
  const region = (process.env.GOOGLE_PLACES_REGION || "").trim();
  const url = new URL(`${LEGACY_BASE}/place/autocomplete/json`);
  url.searchParams.set("input", input);
  url.searchParams.set("key", key);
  url.searchParams.set("language", LANG);
  url.searchParams.set("sessiontoken", sessionToken);
  if (region) url.searchParams.set("region", region.toLowerCase());

  const data = (await fetchJson(url.toString())) as LegacyAutocompleteResponse;
  const status = clean(data.status);
  if (status && status !== "OK" && status !== "ZERO_RESULTS") {
    throw new Error(`places legacy: ${status}`);
  }
  return (data.predictions || [])
    .map((p) => ({
      placeId: clean(p.place_id),
      mainText: clean(p.structured_formatting?.main_text) || clean(p.description),
      secondaryText: clean(p.structured_formatting?.secondary_text),
    }))
    .filter((s) => s.placeId && s.mainText);
}

let warnedLegacy = false;

function warnFallback(scope: string, err: unknown) {
  if (warnedLegacy) return;
  warnedLegacy = true;
  console.warn(
    `[places] ${scope}: Places API (New) no disponible (${err instanceof Error ? err.message : err}); usando API legacy.`
  );
}

/** Sugiere direcciones probando primero Places API (New) y luego la legacy. */
export async function autocomplete(input: string, sessionToken: string): Promise<Suggestion[]> {
  try {
    return await autocompleteNew(input, sessionToken);
  } catch (err) {
    warnFallback("autocomplete", err);
    return await autocompleteLegacy(input, sessionToken);
  }
}

// --------------------------- Details ---------------------------

async function detailsNew(placeId: string): Promise<PlaceDetails> {
  const key = (process.env.GOOGLE_MAPS_API_KEY || "").trim();
  const url = new URL(`${NEW_BASE}/places/${encodeURIComponent(placeId)}`);
  url.searchParams.set("languageCode", LANG);

  const data = (await fetchJson(url.toString(), {
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "id,formattedAddress,location,addressComponents",
    },
  })) as NewDetailsResponse;

  const lat = data.location?.latitude;
  const lng = data.location?.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") {
    throw new Error("places (new): respuesta sin coordenadas");
  }
  return {
    address: clean(data.formattedAddress),
    lat,
    lng,
    zone: zoneFromComponents(data.addressComponents || []),
  };
}

async function detailsLegacy(placeId: string): Promise<PlaceDetails> {
  const key = (process.env.GOOGLE_MAPS_API_KEY || "").trim();
  const url = new URL(`${LEGACY_BASE}/place/details/json`);
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("key", key);
  url.searchParams.set("language", LANG);
  url.searchParams.set("fields", "formatted_address,geometry,address_component");

  const data = (await fetchJson(url.toString())) as LegacyDetailsResponse;
  const status = clean(data.status);
  if (status !== "OK") throw new Error(`places legacy: ${status}`);

  const r = data.result;
  const lat = r?.geometry?.location?.lat;
  const lng = r?.geometry?.location?.lng;
  if (typeof lat !== "number" || typeof lng !== "number") {
    throw new Error("places (legacy): respuesta sin coordenadas");
  }
  return {
    address: clean(r?.formatted_address),
    lat,
    lng,
    zone: zoneFromComponents(r?.address_components || []),
  };
}

/** Obtiene dirección formateada + coordenadas, probando New y luego legacy. */
export async function placeDetails(placeId: string): Promise<PlaceDetails> {
  try {
    return await detailsNew(placeId);
  } catch (err) {
    warnFallback("details", err);
    return await detailsLegacy(placeId);
  }
}
