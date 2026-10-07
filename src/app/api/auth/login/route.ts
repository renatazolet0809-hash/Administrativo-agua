import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  SESSION_COOKIE,
  getSessionUser,
  jsonError,
  ok,
  signToken,
  verifyPassword,
  ApiError,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      throw new ApiError("Correo y contraseña son obligatorios", 400);
    }

    const user = await db.user.findUnique({
      where: { email },
      include: { role: true },
    });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new ApiError("Credenciales inválidas", 401);
    }
    if (!user.active) {
      throw new ApiError("Usuario inactivo. Contacte al administrador", 403);
    }

    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = signToken(user.id);
    const response = ok({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        roleId: user.roleId,
        roleName: user.role.name,
        permissions: JSON.parse(user.role.permissions),
      },
    });

    response.headers.append(
      "Set-Cookie",
      `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${60 * 60 * 12}; SameSite=Lax`
    );
    return response;
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    return ok({ authenticated: !!user });
  } catch (error) {
    return jsonError(error);
  }
}
