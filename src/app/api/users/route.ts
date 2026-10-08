import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError, hashPassword, jsonError, ok, requirePermission } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "users.manage");
    const users = await db.user.findMany({
      include: { role: true },
      orderBy: { id: "asc" },
    });
    return ok(
      users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        active: u.active,
        lastLoginAt: u.lastLoginAt,
        roleId: u.roleId,
        role: { id: u.role.id, name: u.role.name },
      }))
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, "users.manage");
    const body = await request.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const roleId = Number(body.roleId);

    if (!name || !email || !password || !roleId) {
      throw new ApiError("Nombre, correo, contraseña y rol son obligatorios");
    }
    if (password.length < 6) {
      throw new ApiError("La contraseña debe tener al menos 6 caracteres");
    }

    const exists = await db.user.findUnique({ where: { email } });
    if (exists) throw new ApiError("Ya existe un usuario con ese correo", 409);

    const user = await db.user.create({
      data: {
        name,
        email,
        passwordHash: hashPassword(password),
        phone: body.phone ? String(body.phone) : null,
        roleId,
        active: body.active !== false,
      },
      include: { role: true },
    });
    return ok(
      { id: user.id, name: user.name, email: user.email, role: { name: user.role.name } },
      201
    );
  } catch (error) {
    return jsonError(error);
  }
}
