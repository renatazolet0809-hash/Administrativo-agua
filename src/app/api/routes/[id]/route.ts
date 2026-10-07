import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError, jsonError, ok, requireAuth, hasPermission } from "@/lib/auth";

// Detalle completo de la ruta (usado por la app del chofer y el panel)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const route = await db.deliveryRoute.findUnique({
      where: { id: Number(id) },
      include: {
        driver: { select: { id: true, name: true, phone: true } },
        vehicle: true,
        stops: {
          include: {
            customer: true,
            order: { include: { items: { include: { product: true } } } },
          },
          orderBy: { sequence: "asc" },
        },
      },
    });
    if (!route) throw new ApiError("Ruta no encontrada", 404);

    // El chofer solo puede ver sus propias rutas
    if (route.driverId !== user.id && !hasPermission(user, "routes.view")) {
      throw new ApiError("No tiene acceso a esta ruta", 403);
    }
    return ok(route);
  } catch (error) {
    return jsonError(error);
  }
}

// Acciones: iniciar ruta, completar ruta, actualizar estado de una parada
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const routeId = Number(id);
    const body = await request.json();
    const action = String(body.action || "");

    const route = await db.deliveryRoute.findUnique({
      where: { id: routeId },
      include: { stops: { include: { order: { include: { items: true } } } } },
    });
    if (!route) throw new ApiError("Ruta no encontrada", 404);

    const isDriver = route.driverId === user.id;
    const canManage = hasPermission(user, "routes.manage");
    const canExecute = hasPermission(user, "delivery.execute");
    if (!canManage && !(isDriver && canExecute)) {
      throw new ApiError("No tiene permisos para esta acción", 403);
    }

    // ----- INICIAR RUTA: carga de botellones (descarga de inventario) -----
    if (action === "START") {
      if (route.status !== "PLANIFICADA") {
        throw new ApiError("La ruta ya fue iniciada o finalizada");
      }

      // Consolidar botellones por producto para el despacho
      const totals: Record<number, number> = {};
      for (const stop of route.stops) {
        for (const item of stop.order?.items || []) {
          totals[item.productId] = (totals[item.productId] || 0) + item.quantity;
        }
      }

      for (const [productIdStr, qty] of Object.entries(totals)) {
        const productId = Number(productIdStr);
        const product = await db.product.findUnique({ where: { id: productId } });
        if (!product) throw new ApiError(`Producto ${productId} no encontrado`, 404);
        if (product.stock < qty) {
          throw new ApiError(
            `Stock insuficiente de ${product.name}. Disponible: ${product.stock}, requerido: ${qty}`
          );
        }
      }

      await db.$transaction(async (tx) => {
        for (const [productIdStr, qty] of Object.entries(totals)) {
          const productId = Number(productIdStr);
          await tx.dispatch.create({
            data: { routeId, productId, userId: user.id, quantity: qty },
          });
          await tx.inventoryMovement.create({
            data: {
              productId,
              type: "SALIDA",
              quantity: qty,
              reason: `Despacho ruta #${routeId} - ${route.name}`,
              userId: user.id,
            },
          });
          await tx.product.update({
            where: { id: productId },
            data: { stock: { decrement: qty } },
          });
        }
        await tx.deliveryRoute.update({
          where: { id: routeId },
          data: { status: "EN_CURSO", startedAt: new Date() },
        });
        await tx.routeStop.updateMany({
          where: { routeId, orderId: { not: null } },
          data: {},
        });
        const orderIds = route.stops.map((s) => s.orderId).filter(Boolean) as number[];
        if (orderIds.length) {
          await tx.order.updateMany({ where: { id: { in: orderIds } }, data: { status: "EN_RUTA" } });
        }
      });

      return ok({ success: true, status: "EN_CURSO" });
    }

    // ----- COMPLETAR RUTA -----
    if (action === "COMPLETE") {
      if (route.status !== "EN_CURSO") throw new ApiError("La ruta no está en curso");
      const pending = route.stops.filter((s) => s.status === "PENDIENTE" || s.status === "EN_CAMINO");
      if (pending.length > 0 && !body.force) {
        throw new ApiError(`Hay ${pending.length} paradas sin atender. Confirme o force el cierre`);
      }
      await db.$transaction(async (tx) => {
        await tx.deliveryRoute.update({
          where: { id: routeId },
          data: { status: "COMPLETADA", completedAt: new Date() },
        });
        for (const stop of pending) {
          if (stop.orderId) {
            await tx.order.update({ where: { id: stop.orderId }, data: { status: "CONFIRMADO" } });
          }
        }
      });
      return ok({ success: true, status: "COMPLETADA" });
    }

    // ----- ACTUALIZAR PARADA -----
    if (action === "STOP_STATUS") {
      const stopId = Number(body.stopId);
      const stopStatus = String(body.status || "");
      if (!["PENDIENTE", "EN_CAMINO", "ENTREGADO", "NO_ENTREGADO"].includes(stopStatus)) {
        throw new ApiError("Estado de parada inválido");
      }
      const stop = await db.routeStop.findUnique({ where: { id: stopId } });
      if (!stop || stop.routeId !== routeId) throw new ApiError("Parada no encontrada", 404);

      await db.$transaction(async (tx) => {
        await tx.routeStop.update({
          where: { id: stopId },
          data: {
            status: stopStatus,
            deliveredAt: stopStatus === "ENTREGADO" ? new Date() : null,
            notes: body.notes !== undefined ? String(body.notes || "") : undefined,
          },
        });
        if (stop.orderId) {
          if (stopStatus === "ENTREGADO") {
            await tx.order.update({ where: { id: stop.orderId }, data: { status: "ENTREGADO" } });
          } else if (stopStatus === "NO_ENTREGADO") {
            await tx.order.update({ where: { id: stop.orderId }, data: { status: "CONFIRMADO" } });
          } else if (stopStatus === "EN_CAMINO") {
            await tx.order.update({ where: { id: stop.orderId }, data: { status: "EN_RUTA" } });
          }
        }
      });
      return ok({ success: true });
    }

    throw new ApiError("Acción inválida");
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(request);
    if (!hasPermission(user, "routes.manage")) {
      throw new ApiError("No tiene permisos para esta acción", 403);
    }
    const { id } = await params;
    const routeId = Number(id);
    const route = await db.deliveryRoute.findUnique({ where: { id: routeId } });
    if (!route) throw new ApiError("Ruta no encontrada", 404);
    if (route.status === "EN_CURSO") {
      throw new ApiError("No se puede cancelar una ruta en curso. Finalícela primero");
    }

    await db.$transaction(async (tx) => {
      await tx.deliveryRoute.update({ where: { id: routeId }, data: { status: "CANCELADA" } });
      const stops = await tx.routeStop.findMany({ where: { routeId, orderId: { not: null } } });
      const orderIds = stops.map((s) => s.orderId as number);
      if (orderIds.length) {
        await tx.order.updateMany({
          where: { id: { in: orderIds }, status: "EN_RUTA" },
          data: { status: "CONFIRMADO" },
        });
      }
    });
    return ok({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
