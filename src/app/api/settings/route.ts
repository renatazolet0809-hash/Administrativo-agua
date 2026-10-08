import { NextRequest } from "next/server";
import { requireAuth, hasPermission, getSessionUser, jsonError, ok, ApiError } from "@/lib/auth";
import { getSettings, saveSettings, publicSettings } from "@/lib/settings";

/**
 * GET /api/settings
 *  - Sin sesión: devuelve solo las claves públicas (login necesita nombre, logo, umbral)
 *  - Con sesión: devuelve todas
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    const all = await getSettings();
    return ok(user ? all : publicSettings(all));
  } catch (error) {
    return jsonError(error);
  }
}

/** PUT /api/settings — requiere permiso settings.manage. Body: { values: { clave: valor } } */
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (!hasPermission(user, "settings.manage")) {
      throw new ApiError("No tiene permisos para modificar la configuración", 403);
    }
    const body = await request.json();
    const values = body?.values;
    if (!values || typeof values !== "object" || Array.isArray(values)) {
      throw new ApiError("Formato inválido: se esperaba { values: { clave: valor } }", 400);
    }
    await saveSettings(values as Record<string, string>);
    const all = await getSettings();
    return ok(all);
  } catch (error) {
    return jsonError(error);
  }
}
