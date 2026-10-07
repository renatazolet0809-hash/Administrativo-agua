import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError, hashPassword, jsonError, ok, requirePermission } from "@/lib/auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(request, "users.manage");
    const { id } = await params;
    const userId = Number(id);
    const body = await request.json();

    const existing = await db.user.findUnique({ where: { id: userId } });
    if (!existing) throw new ApiError("Usuario no encontrado", 404);

    const data: Record<string, unknown> = {};
    if (body.name) data.name = String(body.name).trim();
    if (body.phone !== undefined) data.phone = body.phone ? String(body.phone) : null;
    if (body.roleId) data.roleId = Number(body.roleId);
    if (body.active !== undefined) data.active = Boolean(body.active);
    if (body.password) {
      if (String(body.password).length < 6) {
        throw new ApiError("La contraseña debe tener al menos 6 caracteres");
      }
      data.passwordHash = hashPassword(String(body.password));
    }

    const user = await db.user.update({
      where: { id: userId },
      data,
      include: { role: true },
    });
    return ok({
      id: user.id,
      name: user.name,
      email: user.email,
      roleId: user.roleId,
      active: user.active,
      role: { name: user.role.name },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(request, "users.manage");
    const { id } = await params;
    const userId = Number(id);

    const existing = await db.user.findUnique({ where: { id: userId } });
    if (!existing) throw new ApiError("Usuario no encontrado", 404);

    // Desactivar en lugar de eliminar (integridad referencial)
    await db.user.update({ where: { id: userId }, data: { active: false } });
    return ok({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
