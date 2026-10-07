import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { jsonError, ok, requirePermission } from "@/lib/auth";

// GET /api/reports/sales?from=&to=&status= — datos agregados para el reporte PDF de ventas
export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "reports.view");
    const { searchParams } = new URL(request.url);

    const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : new Date();
    to.setHours(23, 59, 59, 999);
    const from = searchParams.get("from")
      ? new Date(searchParams.get("from")!)
      : new Date(to.getTime() - 29 * 24 * 3600 * 1000);
    from.setHours(0, 0, 0, 0);

    const status = searchParams.get("status");

    const orders = await db.order.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        ...(status ? { status } : { status: { not: "CANCELADO" } }),
      },
      include: {
        customer: { select: { id: true, name: true, zone: true } },
        items: { include: { product: { select: { id: true, name: true, sizeLiters: true } } } },
        routeStops: {
          select: { route: { select: { driver: { select: { name: true } } } } },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });

    // ---- Agregaciones ----
    const byProductMap = new Map<string, { name: string; qty: number; revenue: number }>();
    const byCustomerMap = new Map<string, { name: string; zone: string; orders: number; revenue: number }>();
    const byDriverMap = new Map<string, { name: string; deliveries: number; revenue: number }>();
    const byDayMap = new Map<string, { date: string; revenue: number; orders: number }>();
    const statusCounts: Record<string, number> = {};

    let revenue = 0;
    let units = 0;

    for (const o of orders) {
      revenue += o.total;
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;

      const dayKey = o.createdAt.toISOString().slice(0, 10);
      const day = byDayMap.get(dayKey) || { date: dayKey, revenue: 0, orders: 0 };
      day.revenue += o.total;
      day.orders += 1;
      byDayMap.set(dayKey, day);

      const cust = byCustomerMap.get(o.customer.name) || {
        name: o.customer.name, zone: o.customer.zone, orders: 0, revenue: 0,
      };
      cust.orders += 1;
      cust.revenue += o.total;
      byCustomerMap.set(o.customer.name, cust);

      for (const it of o.items) {
        units += it.quantity;
        const key = it.product.name;
        const p = byProductMap.get(key) || { name: key, qty: 0, revenue: 0 };
        p.qty += it.quantity;
        p.revenue += it.quantity * it.unitPrice;
        byProductMap.set(key, p);
      }

      const driverName = o.routeStops[0]?.route.driver.name;
      if (driverName) {
        const d = byDriverMap.get(driverName) || { name: driverName, deliveries: 0, revenue: 0 };
        d.deliveries += 1;
        d.revenue += o.total;
        byDriverMap.set(driverName, d);
      }
    }

    const sortDesc = (a: { revenue: number }, b: { revenue: number }) => b.revenue - a.revenue;

    const list = orders.map((o) => ({
      id: o.id,
      date: o.createdAt.toISOString(),
      customer: o.customer.name,
      zone: o.customer.zone,
      items: o.items.map((it) => `${it.quantity}× ${it.product.name}`).join(", "),
      units: o.items.reduce((s, it) => s + it.quantity, 0),
      total: o.total,
      status: o.status,
      driver: o.routeStops[0]?.route.driver.name || null,
    }));

    return ok({
      period: { from: from.toISOString(), to: to.toISOString() },
      summary: {
        orders: orders.length,
        revenue: Math.round(revenue * 100) / 100,
        units,
        avgTicket: orders.length ? Math.round((revenue / orders.length) * 100) / 100 : 0,
      },
      statusCounts,
      byDay: Array.from(byDayMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
      byProduct: Array.from(byProductMap.values()).sort(sortDesc),
      byCustomer: Array.from(byCustomerMap.values()).sort(sortDesc),
      byDriver: Array.from(byDriverMap.values()).sort(sortDesc),
      orders: list,
    });
  } catch (error) {
    return jsonError(error);
  }
}
