import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError, jsonError, ok, requirePermission } from "@/lib/auth";

const ORDER_STATUSES = ["PENDIENTE", "CONFIRMADO", "EN_RUTA", "ENTREGADO", "CANCELADO"];

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
    return ok({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
