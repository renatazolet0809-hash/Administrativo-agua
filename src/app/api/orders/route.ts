import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError, hasPermission, jsonError, ok, requireAuth } from "@/lib/auth";
import { notifyStaffAboutNewOrder } from "@/lib/notify";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    // CLIENTE: solo ve sus propios pedidos (portal de autopedido)
    const isClient = user.roleName === "CLIENTE";
    if (!isClient && !hasPermission(user, "orders.view")) {
      throw new ApiError("No tiene permisos para esta acción", 403);
    }

    const where: Record<string, unknown> = status ? { status } : {};
    if (isClient) where.customerId = user.customerId ?? -1;

    const orders = await db.order.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true, address: true, zone: true } },
        user: { select: { name: true } },
        items: { include: { product: true } },
        routeStops: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return ok(orders);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const items = Array.isArray(body.items) ? body.items : [];

    // Dos vías de creación:
    // 1. Personal interno con orders.manage (crea en nombre de cualquier cliente)
    // 2. Cliente registrado (rol CLIENTE) crea su propio pedido desde el portal
    const isClient = user.roleName === "CLIENTE";
    let customerId: number;

    if (isClient) {
      if (!user.customerId) {
        throw new ApiError("Su cuenta no está vinculada a un perfil de cliente", 403);
      }
      customerId = user.customerId;
    } else {
      if (!hasPermission(user, "orders.manage")) {
        throw new ApiError("No tiene permisos para esta acción", 403);
      }
      customerId = Number(body.customerId);
    }

    if (!customerId || items.length === 0) {
      throw new ApiError("Cliente y al menos un producto son obligatorios");
    }

    const customer = await db.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new ApiError("Cliente no encontrado", 404);

    let total = 0;
    const itemData: { productId: number; quantity: number; unitPrice: number }[] = [];
    for (const item of items) {
      const productId = Number(item.productId);
      const quantity = Number(item.quantity);
      if (!productId || !quantity || quantity <= 0) {
        throw new ApiError("Cada item debe tener producto y cantidad válidos");
      }
      const product = await db.product.findUnique({ where: { id: productId } });
      if (!product || !product.active) throw new ApiError(`Producto ${productId} no disponible`, 404);
      total += product.price * quantity;
      itemData.push({ productId, quantity, unitPrice: product.price });
    }

    const order = await db.order.create({
      data: {
        customerId,
        userId: user.id,
        notes: body.notes ? String(body.notes) : null,
        total,
        items: { create: itemData },
      },
      include: {
        customer: { select: { name: true } },
        items: { include: { product: true } },
      },
    });

    // Pedido desde el portal → avisa al personal para confirmarlo
    if (isClient) {
      await notifyStaffAboutNewOrder({
        orderId: order.id,
        customerName: customer.name,
        total,
        excludeUserId: user.id,
      });
    }

    return ok(order, 201);
  } catch (error) {
    return jsonError(error);
  }
}
