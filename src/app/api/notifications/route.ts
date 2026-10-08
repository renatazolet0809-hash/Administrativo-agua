import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { jsonError, ok, requireAuth } from "@/lib/auth";

// Bandeja de notificaciones del usuario autenticado (web + app)
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const [notifications, unread] = await Promise.all([
      db.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      db.notification.count({ where: { userId: user.id, read: false } }),
    ]);
    return ok({ notifications, unread });
  } catch (error) {
    return jsonError(error);
  }
}

// Marcar como leída (una o todas)
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json().catch(() => ({}));

    if (body.all) {
      await db.notification.updateMany({
        where: { userId: user.id, read: false },
        data: { read: true },
      });
      return ok({ success: true });
    }
    if (body.id) {
      await db.notification.updateMany({
        where: { id: Number(body.id), userId: user.id },
        data: { read: true },
      });
      return ok({ success: true });
    }
    return ok({ success: false });
  } catch (error) {
    return jsonError(error);
  }
}
