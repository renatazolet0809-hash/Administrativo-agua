import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError, jsonError, ok, requirePermission } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "orders.view");
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const orders = await db.order.findMany({
      where: status ? { status } : undefined,
      include: {
        customer: { select: { id: true, name: true, phone: true, address: true, zone: true } },
        user: { select: { name: true } },
        items: { include: { product: true } },
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
    const user = await requirePermission(request, "orders.manage");
    const body = await request.json();
    const customerId = Number(body.customerId);
    const items = Array.isArray(body.items) ? body.items : [];

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
      if (!product) throw new ApiError(`Producto ${productId} no encontrado`, 404);
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
    return ok(order, 201);
  } catch (error) {
    return jsonError(error);
  }
}
