import { NextRequest } from "next/server";
import { ok } from "@/lib/auth";
import { autocomplete, placesEnabled, rateLimit } from "@/lib/places";

// POST /api/places/autocomplete
// Body: { input: string, sessionToken?: string }
// Sin GOOGLE_MAPS_API_KEY configurada responde { enabled: false } y el
// formulario sigue funcionando como campo de texto normal.
export async function POST(request: NextRequest) {
  if (!placesEnabled()) return ok({ enabled: false, suggestions: [] });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`places-ac:${ip}`, 120)) {
    return ok({ enabled: true, suggestions: [] });
  }

  try {
    const body = await request.json();
    const input = String(body?.input || "").trim();
    const sessionToken = String(body?.sessionToken || "").trim() || "sin-sesion";

    if (input.length < 3) return ok({ enabled: true, suggestions: [] });

    const suggestions = await autocomplete(input, sessionToken);
    return ok({ enabled: true, suggestions });
  } catch (e) {
    // Clave inválida, cuota agotada, red… → degradación silenciosa:
    // el usuario simplemente escribe la dirección a mano.
    console.error("[places/autocomplete]", e instanceof Error ? e.message : e);
    return ok({ enabled: false, suggestions: [] });
  }
}
