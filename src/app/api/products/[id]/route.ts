import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError, jsonError, ok, requirePermission } from "@/lib/auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(request, "products.manage");
    const { id } = await params;
    const body = await request.json();
    const existing = await db.product.findUnique({ where: { id: Number(id) } });
    if (!existing) throw new ApiError("Producto no encontrado", 404);

    const product = await db.product.update({
      where: { id: Number(id) },
      data: {
        name: body.name !== undefined ? String(body.name) : undefined,
        price: body.price !== undefined ? Number(body.price) : undefined,
        cost: body.cost !== undefined ? Number(body.cost) : undefined,
        stock: body.stock !== undefined ? Number(body.stock) : undefined,
        minStock: body.minStock !== undefined ? Number(body.minStock) : undefined,
        active: body.active !== undefined ? Boolean(body.active) : undefined,
      },
    });
    return ok(product);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(request, "products.manage");
    const { id } = await params;
    const existing = await db.product.findUnique({ where: { id: Number(id) } });
    if (!existing) throw new ApiError("Producto no encontrado", 404);

    await db.product.update({ where: { id: Number(id) }, data: { active: false } });
    return ok({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
