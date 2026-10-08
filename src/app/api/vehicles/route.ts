import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError, jsonError, ok, requirePermission } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "routes.view");
    const vehicles = await db.vehicle.findMany({ where: { active: true } });
    return ok(vehicles);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, "routes.manage");
    const body = await request.json();
    const plate = String(body.plate || "").trim().toUpperCase();
    const model = String(body.model || "").trim();
    if (!plate || !model) throw new ApiError("Placa y modelo son obligatorios");

    const exists = await db.vehicle.findUnique({ where: { plate } });
    if (exists) throw new ApiError("Ya existe un vehículo con esa placa", 409);

    const vehicle = await db.vehicle.create({
      data: {
        plate,
        model,
        capacityLiters: Number(body.capacityLiters || 1000),
      },
    });
    return ok(vehicle, 201);
  } catch (error) {
    return jsonError(error);
  }
}
