import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError, hasPermission, jsonError, ok, requireAuth } from "@/lib/auth";
import { notifyCustomerUsers } from "@/lib/notify";

// POST /api/stops/:id/proof — el chofer sube el comprobante fotográfico de la entrega
// Body: { photo: dataURL, lat, lng, accuracy?, note? }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const stopId = Number(id);
    const body = await request.json();

    const photo = String(body.photo || "");
    if (!photo.startsWith("data:image/")) {
      throw new ApiError("Debe adjuntar una fotografía del comprobante");
    }
    if (photo.length > 2_000_000) {
      throw new ApiError("La fotografía es demasiado grande. Intente de nuevo");
    }
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!isFinite(lat) || !isFinite(lng)) {
      throw new ApiError("No se pudo obtener la ubicación GPS. Active el GPS e intente de nuevo");
    }

    const stop = await db.routeStop.findUnique({
      where: { id: stopId },
      include: { route: true },
    });
    if (!stop) throw new ApiError("Parada no encontrada", 404);

    const isDriver = stop.route.driverId === user.id;
    const canExecute = hasPermission(user, "delivery.execute");
    const canManage = hasPermission(user, "routes.manage");
    if (!canManage && !(isDriver && canExecute)) {
      throw new ApiError("No tiene permisos para registrar esta entrega", 403);
    }
    if (stop.status === "ENTREGADO" && stop.proof) {
      throw new ApiError("Esta parada ya tiene un comprobante registrado");
    }

    const result = await db.$transaction(async (tx) => {
      const proof = await tx.deliveryProof.upsert({
        where: { stopId },
        create: {
          stopId,
          routeId: stop.routeId,
          photoData: photo,
          lat,
          lng,
          accuracy: Number(body.accuracy) || 0,
          note: body.note ? String(body.note) : null,
        },
        update: {
          photoData: photo,
          lat,
          lng,
          accuracy: Number(body.accuracy) || 0,
          note: body.note ? String(body.note) : null,
        },
      });
      await tx.routeStop.update({
        where: { id: stopId },
        data: { status: "ENTREGADO", deliveredAt: new Date() },
      });
      if (stop.orderId) {
        await tx.order.update({
          where: { id: stop.orderId },
          data: { status: "ENTREGADO" },
        });
      }
      return proof;
    });

    // Notificar al cliente (portal web) que su pedido fue entregado
    if (stop.orderId) {
      const order = await db.order.findUnique({ where: { id: stop.orderId }, select: { customerId: true } });
      if (order) {
        await notifyCustomerUsers(
          order.customerId,
          "PEDIDO_ENTREGADO",
          "Pedido entregado ✓",
          `Su pedido #${stop.orderId} fue entregado. Ya puede ver el comprobante fotográfico en el portal.`,
          { orderId: stop.orderId }
        );
      }
    }

    return ok({ success: true, proofId: result.id }, 201);
  } catch (error) {
    return jsonError(error);
  }
}

// GET /api/stops/:id/proof — consultar el comprobante (chofer, admin o el cliente del pedido)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const proof = await db.deliveryProof.findUnique({
      where: { stopId: Number(id) },
      include: { stop: { select: { customerId: true, orderId: true } } },
    });
    if (!proof) throw new ApiError("Comprobante no encontrado", 404);

    const isLinkedClient = user.customerId && user.customerId === proof.stop.customerId;
    if (
      !isLinkedClient &&
      proof.routeId &&
      !hasPermission(user, "routes.view") &&
      !hasPermission(user, "delivery.execute")
    ) {
      // verificar si es el chofer de la ruta
      const route = await db.deliveryRoute.findUnique({ where: { id: proof.routeId } });
      if (!route || route.driverId !== user.id) {
        throw new ApiError("No tiene acceso a este comprobante", 403);
      }
    }

    return ok(proof);
  } catch (error) {
    return jsonError(error);
  }
}
