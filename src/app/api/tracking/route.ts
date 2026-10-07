import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError, jsonError, ok, requireAuth, hasPermission } from "@/lib/auth";

// POST: el chofer envía su posición GPS (desde la app)
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (!hasPermission(user, "tracking.send")) {
      throw new ApiError("No tiene permisos para enviar posición", 403);
    }
    const body = await request.json();
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (isNaN(lat) || isNaN(lng)) throw new ApiError("Coordenadas inválidas");

    const point = await db.trackingPoint.create({
      data: {
        userId: user.id,
        routeId: body.routeId ? Number(body.routeId) : null,
        lat,
        lng,
        speed: Number(body.speed || 0),
        accuracy: Number(body.accuracy || 0),
      },
    });
    return ok(point, 201);
  } catch (error) {
    return jsonError(error);
  }
}

// GET: posiciones en vivo para el panel de seguimiento
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (!hasPermission(user, "tracking.view")) {
      throw new ApiError("No tiene permisos para ver el seguimiento", 403);
    }
    const { searchParams } = new URL(request.url);
    const routeId = searchParams.get("routeId");

    // Trail de una ruta específica (últimos 60 puntos)
    if (routeId) {
      const points = await db.trackingPoint.findMany({
        where: { routeId: Number(routeId) },
        orderBy: { createdAt: "desc" },
        take: 60,
      });
      return ok(points.reverse());
    }

    // Última posición de cada chofer con ruta EN_CURSO
    const activeRoutes = await db.deliveryRoute.findMany({
      where: { status: "EN_CURSO" },
      include: {
        driver: { select: { id: true, name: true, phone: true } },
        vehicle: { select: { plate: true, model: true } },
        stops: {
          include: {
            customer: { select: { id: true, name: true, lat: true, lng: true, address: true } },
          },
          orderBy: { sequence: "asc" },
        },
      },
    });

    const result = [];
    for (const route of activeRoutes) {
      const lastPoint = await db.trackingPoint.findFirst({
        where: { userId: route.driverId },
        orderBy: { createdAt: "desc" },
      });
      const nextStop = route.stops.find((s) => s.status === "PENDIENTE" || s.status === "EN_CAMINO");
      result.push({
        routeId: route.id,
        routeName: route.name,
        driver: route.driver,
        vehicle: route.vehicle,
        position: lastPoint,
        nextStop: nextStop || null,
        stops: route.stops,
      });
    }
    return ok(result);
  } catch (error) {
    return jsonError(error);
  }
}
