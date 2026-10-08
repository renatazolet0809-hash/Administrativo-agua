import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError, jsonError, ok, requirePermission } from "@/lib/auth";
import { notifyCustomerUsers } from "@/lib/notify";

const ORDER_STATUSES = ["PENDIENTE", "CONFIRMADO", "EN_RUTA", "ENTREGADO", "CANCELADO"];

const CLIENT_NOTIFICATIONS: Record<string, { title: string; body: (id: number) => string }> = {
  CONFIRMADO: {
    title: "Pedido confirmado",
    body: (id) => `Su pedido #${id} fue confirmado y pronto será programado en una ruta de despacho.`,
  },
  EN_RUTA: {
    title: "Pedido en ruta 🚚",
    body: (id) => `Su pedido #${id} salió a reparto. Pronto recibirá la visita del chofer.`,
  },
  ENTREGADO: {
    title: "Pedido entregado ✓",
    body: (id) => `Su pedido #${id} fue entregado. Revise el comprobante fotográfico en el portal.`,
  },
  CANCELADO: {
    title: "Pedido cancelado",
    body: (id) => `Su pedido #${id} fue cancelado. Si tiene dudas, contacte a nuestro personal.`,
  },
};

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(request, "orders.manage");
    const { id } = await params;
    const body = await request.json();
    const existing = await db.order.findUnique({ where: { id: Number(id) } });
    if (!existing) throw new ApiError("Pedido no encontrado", 404);

    if (body.status && !ORDER_STATUSES.includes(String(body.status))) {
      throw new ApiError("Estado de pedido inválido");
    }

    const order = await db.order.update({
      where: { id: Number(id) },
      data: {
        status: body.status !== undefined ? String(body.status) : undefined,
        notes: body.notes !== undefined ? (body.notes ? String(body.notes) : null) : undefined,
      },
      include: {
        customer: { select: { name: true } },
        items: { include: { product: true } },
      },
    });

    // Notificar al cliente del portal cuando el estado cambia
    const newStatus = body.status !== undefined ? String(body.status) : null;
    if (newStatus && CLIENT_NOTIFICATIONS[newStatus]) {
      const tpl = CLIENT_NOTIFICATIONS[newStatus];
      await notifyCustomerUsers(
        existing.customerId,
        newStatus === "CONFIRMADO" ? "PEDIDO_CONFIRMADO"
        : newStatus === "EN_RUTA" ? "PEDIDO_EN_RUTA"
        : newStatus === "ENTREGADO" ? "PEDIDO_ENTREGADO"
        : "PEDIDO_CANCELADO",
        tpl.title,
        tpl.body(order.id),
        { orderId: order.id }
      );
    }

    return ok(order);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(request, "orders.manage");
    const { id } = await params;
    const existing = await db.order.findUnique({ where: { id: Number(id) } });
    if (!existing) throw new ApiError("Pedido no encontrado", 404);

    await db.order.update({ where: { id: Number(id) }, data: { status: "CANCELADO" } });
    await notifyCustomerUsers(
      existing.customerId,
      "PEDIDO_CANCELADO",
      "Pedido cancelado",
      `Su pedido #${existing.id} fue cancelado. Si tiene dudas, contacte a nuestro personal.`,
      { orderId: existing.id }
    );
    return ok({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
