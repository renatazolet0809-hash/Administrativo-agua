import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError, jsonError, ok, requireAuth, requirePermission } from "@/lib/auth";

// Historial de movimientos
export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "products.view");
    const movements = await db.inventoryMovement.findMany({
      include: { product: true, user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return ok(movements);
  } catch (error) {
    return jsonError(error);
  }
}

// Registrar entrada / salida / ajuste de inventario
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission(request, "inventory.manage");
    const body = await request.json();
    const productId = Number(body.productId);
    const type = String(body.type || ""); // ENTRADA | SALIDA | AJUSTE
    const quantity = Number(body.quantity);

    if (!productId || !["ENTRADA", "SALIDA", "AJUSTE"].includes(type) || !quantity) {
      throw new ApiError("Producto, tipo de movimiento y cantidad son obligatorios");
    }

    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) throw new ApiError("Producto no encontrado", 404);

    let newStock = product.stock;
    if (type === "ENTRADA") newStock += quantity;
    else if (type === "SALIDA") {
      if (quantity > product.stock) {
        throw new ApiError(`Stock insuficiente. Disponible: ${product.stock}`);
      }
      newStock -= quantity;
    } else newStock = quantity; // AJUSTE fija el stock

    const [movement] = await db.$transaction([
      db.inventoryMovement.create({
        data: {
          productId,
          type,
          quantity: type === "AJUSTE" ? Math.abs(quantity - product.stock) : quantity,
          reason: body.reason ? String(body.reason) : null,
          userId: user.id,
        },
      }),
      db.product.update({ where: { id: productId }, data: { stock: newStock } }),
    ]);

    return ok(movement, 201);
  } catch (error) {
    return jsonError(error);
  }
}
