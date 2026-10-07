import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError, jsonError, ok, requireAuth, hasPermission } from "@/lib/auth";
import { createNotification, notifyCustomerUsers } from "@/lib/notify";

function fmtShort(d: Date): string {
  return d.toLocaleDateString("es-VE", { day: "2-digit", month: "short" });
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const mine = searchParams.get("mine");

    // Solo ve TODAS las rutas quien tenga permiso; el chofer ve solo las suyas
    const canViewAll = hasPermission(user, "routes.view");
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (!canViewAll || mine === "1") where.driverId = user.id;

    const routes = await db.deliveryRoute.findMany({
      where,
      include: {
        driver: { select: { id: true, name: true, phone: true } },
        vehicle: { select: { id: true, plate: true, model: true } },
        stops: {
          include: {
            customer: { select: { id: true, name: true, address: true, zone: true, lat: true, lng: true, phone: true } },
            proof: { select: { id: true, lat: true, lng: true, createdAt: true } },
          },
          orderBy: { sequence: "asc" },
        },
      },
      orderBy: { date: "desc" },
      take: 100,
    });
    return ok(routes);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (!hasPermission(user, "routes.manage")) {
      throw new ApiError("No tiene permisos para esta acción", 403);
    }

    const body = await request.json();
    const name = String(body.name || "").trim();
    const driverId = Number(body.driverId);
    const orderIds = (Array.isArray(body.orderIds) ? body.orderIds : []).map(Number).filter(Boolean);
    const date = body.date ? new Date(body.date) : new Date();

    if (!name || !driverId) throw new ApiError("Nombre de ruta y chofer son obligatorios");
    if (orderIds.length === 0) throw new ApiError("Debe asignar al menos un pedido a la ruta");

    const driver = await db.user.findFirst({
      where: { id: driverId, active: true },
      include: { role: true },
    });
    if (!driver) throw new ApiError("Chofer no encontrado", 404);

    const orders = await db.order.findMany({
      where: { id: { in: orderIds }, status: { in: ["PENDIENTE", "CONFIRMADO"] } },
      include: { items: { include: { product: true } }, customer: true },
    });
    if (orders.length === 0) {
      throw new ApiError("Los pedidos seleccionados no están disponibles (ya despachados o cancelados)");
    }

    const route = await db.deliveryRoute.create({
      data: {
        name,
        driverId,
        vehicleId: body.vehicleId ? Number(body.vehicleId) : null,
        date,
        notes: body.notes ? String(body.notes) : null,
        stops: {
          create: orders.map((order, index) => ({
            orderId: order.id,
            customerId: order.customerId,
            sequence: index + 1,
            itemsSummary: order.items
              .map((it) => `${it.quantity}× ${it.product.name}`)
              .join(", "),
          })),
        },
      },
      include: {
        driver: { select: { name: true } },
        stops: true,
      },
    });

    // Los pedidos asignados pasan a EN_RUTA (preparados para despacho)
    await db.order.updateMany({
      where: { id: { in: orders.map((o) => o.id) } },
      data: { status: "EN_RUTA" },
    });

    // 🔔 Notificación push al chofer: nueva ruta asignada
    await createNotification({
      userId: driverId,
      type: "RUTA_ASIGNADA",
      title: "Nueva ruta asignada",
      body: `${route.name} · ${route.stops.length} paradas · ${fmtShort(date)}`,
      data: { routeId: route.id },
    });

    // 🔔 Aviso a los clientes del portal que sus pedidos salieron a ruta
    for (const o of orders) {
      await notifyCustomerUsers(
        o.customerId,
        "PEDIDO_EN_RUTA",
        "Pedido en ruta 🚚",
        `Su pedido #${o.id} fue programado en la ruta "${route.name}". Pronto recibirá la visita del chofer.`,
        { orderId: o.id, routeId: route.id }
      );
    }

    return ok(route, 201);
  } catch (error) {
    return jsonError(error);
  }
}
