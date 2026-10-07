import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError, jsonError, ok, requirePermission } from "@/lib/auth";
import { ALL_PERMISSIONS } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "users.manage");
    const roles = await db.role.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: { id: "asc" },
    });
    return ok(roles);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, "roles.manage");
    const body = await request.json();
    const name = String(body.name || "").trim().toUpperCase();
    if (!name) throw new ApiError("El nombre del rol es obligatorio");

    const permissions = (body.permissions || []).filter((p: string) =>
      ALL_PERMISSIONS.includes(p as never)
    );

    const role = await db.role.create({
      data: {
        name,
        description: String(body.description || ""),
        permissions: JSON.stringify(permissions),
      },
    });
    return ok(role, 201);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requirePermission(request, "roles.manage");
    const body = await request.json();
    const id = Number(body.id);
    if (!id) throw new ApiError("ID del rol es obligatorio");

    const existing = await db.role.findUnique({ where: { id } });
    if (!existing) throw new ApiError("Rol no encontrado", 404);

    const permissions = (body.permissions || []).filter((p: string) =>
      ALL_PERMISSIONS.includes(p as never)
    );

    const role = await db.role.update({
      where: { id },
      data: {
        description: body.description !== undefined ? String(body.description) : existing.description,
        permissions: JSON.stringify(permissions),
      },
    });
    return ok(role);
  } catch (error) {
    return jsonError(error);
  }
}
