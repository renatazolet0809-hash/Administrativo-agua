import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError, jsonError, ok, requirePermission } from "@/lib/auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(request, "customers.manage");
    const { id } = await params;
    const body = await request.json();
    const existing = await db.customer.findUnique({ where: { id: Number(id) } });
    if (!existing) throw new ApiError("Cliente no encontrado", 404);

    const customer = await db.customer.update({
      where: { id: Number(id) },
      data: {
        name: body.name !== undefined ? String(body.name) : undefined,
        phone: body.phone !== undefined ? String(body.phone) : undefined,
        email: body.email !== undefined ? (body.email ? String(body.email) : null) : undefined,
        address: body.address !== undefined ? String(body.address) : undefined,
        zone: body.zone !== undefined ? String(body.zone) : undefined,
        lat: body.lat !== undefined ? Number(body.lat) : undefined,
        lng: body.lng !== undefined ? Number(body.lng) : undefined,
        notes: body.notes !== undefined ? (body.notes ? String(body.notes) : null) : undefined,
        active: body.active !== undefined ? Boolean(body.active) : undefined,
      },
    });
    return ok(customer);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(request, "customers.manage");
    const { id } = await params;
    const existing = await db.customer.findUnique({ where: { id: Number(id) } });
    if (!existing) throw new ApiError("Cliente no encontrado", 404);

    await db.customer.update({ where: { id: Number(id) }, data: { active: false } });
    return ok({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
