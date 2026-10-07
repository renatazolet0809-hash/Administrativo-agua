import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError, jsonError, ok, requirePermission } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "products.view");
    const products = await db.product.findMany({ orderBy: { sizeLiters: "asc" } });
    return ok(products);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, "products.manage");
    const body = await request.json();
    const name = String(body.name || "").trim();
    const sizeLiters = Number(body.sizeLiters);
    const price = Number(body.price);

    if (!name || !sizeLiters || !price) {
      throw new ApiError("Nombre, capacidad (litros) y precio son obligatorios");
    }

    const code = String(body.code || "").trim() || `AGU-${sizeLiters}L`;
    const exists = await db.product.findUnique({ where: { code } });
    if (exists) throw new ApiError("Ya existe un producto con ese código", 409);

    const product = await db.product.create({
      data: {
        code,
        name,
        sizeLiters,
        price,
        cost: Number(body.cost || 0),
        stock: Number(body.stock || 0),
        minStock: Number(body.minStock || 10),
        active: body.active !== false,
      },
    });
    return ok(product, 201);
  } catch (error) {
    return jsonError(error);
  }
}
