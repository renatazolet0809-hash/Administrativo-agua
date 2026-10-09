import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  SESSION_COOKIE,
  hashPassword,
  jsonError,
  ok,
  signToken,
  ApiError,
} from "@/lib/auth";
import { parsePermissions } from "@/lib/permissions";

// Registro público de clientes para el portal de autopedido (Fase 4)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const phone = String(body.phone || "").trim();
    const address = String(body.address || "").trim();
    const zone = String(body.zone || "").trim();

    if (!name || !email || !password || !phone || !address || !zone) {
      throw new ApiError("Todos los campos son obligatorios");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ApiError("Correo electrónico inválido");
    }
    if (password.length < 6) {
      throw new ApiError("La contraseña debe tener al menos 6 caracteres");
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) throw new ApiError("Ya existe una cuenta con ese correo", 409);

    const clientRole = await db.role.findUnique({ where: { name: "CLIENTE" } });
    if (!clientRole) throw new ApiError("Rol CLIENTE no configurado en el sistema", 500);

    // Coordenadas de la dirección elegida con el autocompletado de Google
    // Places (enviadas por el portal). Si no vienen (clave de Google no
    // configurada o ingreso manual), se usan las aproximadas por zona.
    const bodyLat = Number(body.lat);
    const bodyLng = Number(body.lng);
    const hasGoogleCoords =
      Number.isFinite(bodyLat) &&
      Number.isFinite(bodyLng) &&
      Math.abs(bodyLat) <= 90 &&
      Math.abs(bodyLng) <= 180 &&
      (bodyLat !== 0 || bodyLng !== 0);

    // Respaldo: coordenadas aproximadas por zona
    const zoneCoords: Record<string, [number, number]> = {
      "LOS PALOS GRANDES": [10.4977, -66.8536],
      CHUAO: [10.4892, -66.8639],
      CHACAO: [10.4989, -66.8574],
      "LAS MERCEDES": [10.4708, -66.8532],
      "EL CAFETAL": [10.4287, -66.8285],
      "EL HATILLO": [10.4321, -66.8351],
      "CARACAS CENTRO": [10.5061, -66.8786],
    };
    const [fallbackLat, fallbackLng] = zoneCoords[zone.toUpperCase()] || [10.4806, -66.9036];
    const lat = hasGoogleCoords ? bodyLat : fallbackLat;
    const lng = hasGoogleCoords ? bodyLng : fallbackLng;

    const result = await db.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          name,
          phone,
          email,
          address,
          zone,
          lat,
          lng,
          notes: "Registrado desde el portal cliente",
        },
      });
      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash: hashPassword(password),
          phone,
          roleId: clientRole.id,
          customerId: customer.id,
        },
      });
      return { customer, user };
    });

    const token = signToken(result.user.id);
    const response = ok({
      token,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        phone: result.user.phone,
        roleId: result.user.roleId,
        roleName: "CLIENTE",
        customerId: result.customer.id,
        permissions: parsePermissions(clientRole.permissions),
      },
    });
    response.headers.append(
      "Set-Cookie",
      `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${60 * 60 * 12}; SameSite=Lax`
    );
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
