import { db } from "@/lib/db";

// Helper central para crear notificaciones in-app (push simulado con polling en la app)
// En producción con React Native/FCM: este mismo punto enviaría el push vía Firebase.

export type NotificationType =
  | "RUTA_ASIGNADA"
  | "PEDIDO_NUEVO"
  | "PEDIDO_CONFIRMADO"
  | "PEDIDO_EN_RUTA"
  | "PEDIDO_ENTREGADO"
  | "PEDIDO_CANCELADO";

export async function createNotification(opts: {
  userId: number;
  type: NotificationType;
  title: string;
  body: string;
  data?: { routeId?: number; orderId?: number };
}) {
  try {
    await db.notification.create({
      data: {
        userId: opts.userId,
        type: opts.type,
        title: opts.title,
        body: opts.body,
        data: JSON.stringify(opts.data || {}),
      },
    });
  } catch (e) {
    // Una notificación fallida no debe romper la operación principal
    console.error("Error creando notificación:", e);
  }
}

// Notifica a los usuarios cliente vinculados a un customer (portal web)
export async function notifyCustomerUsers(
  customerId: number,
  type: NotificationType,
  title: string,
  body: string,
  data?: { routeId?: number; orderId?: number }
) {
  const users = await db.user.findMany({
    where: { customerId, active: true },
    select: { id: true },
  });
  for (const u of users) {
    await createNotification({ userId: u.id, type, title, body, data });
  }
}

// Notifica al personal con gestión de pedidos (ADMIN / SUPERVISOR) sobre un nuevo pedido del portal
export async function notifyStaffAboutNewOrder(opts: {
  orderId: number;
  customerName: string;
  total: number;
  excludeUserId?: number;
}) {
  const staff = await db.user.findMany({
    where: {
      active: true,
      role: { name: { in: ["ADMIN", "SUPERVISOR"] } },
    },
    select: { id: true },
  });
  for (const s of staff) {
    if (s.id === opts.excludeUserId) continue;
    await createNotification({
      userId: s.id,
      type: "PEDIDO_NUEVO",
      title: "Nuevo pedido del portal cliente",
      body: `${opts.customerName} solicitó un pedido por $${opts.total.toFixed(2)}. Revíselo en la sección Pedidos.`,
      data: { orderId: opts.orderId },
    });
  }
}
