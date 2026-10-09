import { NextRequest } from "next/server";
import { ApiError, jsonError, ok } from "@/lib/auth";
import { placeDetails, placesEnabled, rateLimit } from "@/lib/places";

// POST /api/places/details
// Body: { placeId: string }
// Devuelve { address, lat, lng, zone } a partir de un placeId de Google.
export async function POST(request: NextRequest) {
  try {
    if (!placesEnabled()) {
      throw new ApiError("Google Places no está configurado en este servidor", 501);
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!rateLimit(`places-det:${ip}`, 60)) {
      throw new ApiError("Demasiadas solicitudes, intente de nuevo en un momento", 429);
    }

    const body = await request.json();
    const placeId = String(body?.placeId || "").trim();
    if (!placeId) throw new ApiError("placeId es obligatorio", 400);

    let details;
    try {
      details = await placeDetails(placeId);
    } catch (e) {
      console.error("[places/details]", e instanceof Error ? e.message : e);
      throw new ApiError("No se pudo obtener la ubicación de esa dirección", 502);
    }
    if (!details.address) {
      throw new ApiError("No se pudo obtener la dirección completa", 502);
    }
    return ok(details);
  } catch (e) {
    return jsonError(e);
  }
}
