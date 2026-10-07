import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { jsonError, ok, requirePermission } from "@/lib/auth";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "dashboard.view");
    const today = startOfDay();

    const [
      totalCustomers,
      todayOrders,
      pendingOrders,
      todayDelivered,
      activeRoutes,
      lowStockProducts,
      products,
      weeklyOrders,
      recentOrders,
    ] = await Promise.all([
      db.customer.count({ where: { active: true } }),
      db.order.count({ where: { createdAt: { gte: today } } }),
      db.order.count({ where: { status: { in: ["PENDIENTE", "CONFIRMADO"] } } }),
      db.order.count({ where: { status: "ENTREGADO", updatedAt: { gte: today } } }),
      db.deliveryRoute.count({ where: { status: "EN_CURSO" } }),
      db.product.findMany({ where: { active: true } }),
      db.product.findMany({ where: { active: true }, orderBy: { sizeLiters: "asc" } }),
      db.order.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } },
        select: { total: true, createdAt: true, status: true },
      }),
      db.order.findMany({
        include: { customer: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
    ]);

    // Ventas por día (últimos 7 días)
    const salesByDay: { date: string; total: number; pedidos: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = startOfDay(new Date(Date.now() - i * 24 * 3600 * 1000));
      const next = new Date(day.getTime() + 24 * 3600 * 1000);
      const dayOrders = weeklyOrders.filter(
        (o) => o.createdAt >= day && o.createdAt < next && o.status !== "CANCELADO"
      );
      salesByDay.push({
        date: day.toLocaleDateString("es-VE", { weekday: "short", day: "numeric" }),
        total: dayOrders.reduce((s, o) => s + o.total, 0),
        pedidos: dayOrders.length,
      });
    }

    // Ventas por tamaño de botellón (items de pedidos entregados)
    const deliveredItems = await db.orderItem.findMany({
      where: { order: { status: "ENTREGADO" } },
      include: { product: true },
    });
    const salesBySize = products.map((p) => ({
      name: `${p.sizeLiters}L`,
      botellones: deliveredItems.filter((i) => i.productId === p.id).reduce((s, i) => s + i.quantity, 0),
    }));

    return ok({
      kpis: {
        totalCustomers,
        todayOrders,
        pendingOrders,
        todayDelivered,
        activeRoutes,
        lowStock: lowStockProducts.filter((p) => p.stock <= p.minStock).length,
      },
      inventory: products.map((p) => ({
        id: p.id,
        name: p.name,
        sizeLiters: p.sizeLiters,
        stock: p.stock,
        minStock: p.minStock,
        low: p.stock <= p.minStock,
      })),
      salesByDay,
      salesBySize,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        customer: o.customer.name,
        status: o.status,
        total: o.total,
        createdAt: o.createdAt,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
