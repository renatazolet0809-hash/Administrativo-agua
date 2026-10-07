import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError, jsonError, ok, requirePermission } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "customers.view");
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");
    const customers = await db.customer.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q } },
              { phone: { contains: q } },
              { zone: { contains: q } },
            ],
          }
        : undefined,
      orderBy: { name: "asc" },
    });
    return ok(customers);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, "customers.manage");
    const body = await request.json();
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    const address = String(body.address || "").trim();
    const lat = Number(body.lat);
    const lng = Number(body.lng);

    if (!name || !phone || !address || isNaN(lat) || isNaN(lng)) {
      throw new ApiError("Nombre, teléfono, dirección y ubicación (lat/lng) son obligatorios");
    }

    const customer = await db.customer.create({
      data: {
        name,
        phone,
        email: body.email ? String(body.email) : null,
        address,
        zone: String(body.zone || "General"),
        lat,
        lng,
        notes: body.notes ? String(body.notes) : null,
      },
    });
    return ok(customer, 201);
  } catch (error) {
    return jsonError(error);
  }
}
