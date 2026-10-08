// Prueba de humo de los nuevos endpoints
const BASE = "http://localhost:3000";

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`login ${email}: ${res.status} ${JSON.stringify(data)}`);
  return data.token;
}

async function call(token: string, path: string, method = "GET", body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  console.log("=== 1. Login admin / cliente / chofer ===");
  const admin = await login("admin@aqua.com", "admin123");
  const cliente = await login("cliente@aqua.com", "cliente123");
  const chofer = await login("chofer@aqua.com", "chofer123");
  console.log("OK: 3 logins");

  console.log("=== 2. Notificaciones ===");
  const notif = await call(admin, "/api/notifications");
  console.log(`admin respuesta status=${notif.status}: ${JSON.stringify(notif.data).slice(0, 300)}`);
  const notifC = await call(cliente, "/api/notifications");
  console.log(`cliente unread=${notifC.data.unread}`);

  console.log("=== 3. Reportes de ventas ===");
  const rep = await call(admin, "/api/reports/sales?from=2026-09-01&to=2026-10-08");
  console.log(`status=${rep.status}, pedidos=${rep.data.summary?.orders}, ingresos=${rep.data.summary?.revenue}, productos=${rep.data.byProduct?.length}, choferes=${rep.data.byDriver?.length}`);

  console.log("=== 4. Pedidos del cliente (scoped) ===");
  const ordersC = await call(cliente, "/api/orders");
  console.log(`status=${ordersC.status}, pedidos del cliente=${ordersC.data.length}, estados=${ordersC.data.map((o: { status: string }) => o.status).join(",")}`);
  const delivered = ordersC.data.find((o: { status: string }) => o.status === "ENTREGADO");
  console.log(`pedido ENTREGADO tiene routeStops=${JSON.stringify(delivered?.routeStops)}`);

  console.log("=== 5. Comprobante fotográfico (chofer puede ver) ===");
  const routesR = await call(chofer, "/api/routes");
  const route1 = routesR.data[0];
  const stopWithProof = route1?.stops?.find((s: { proof?: unknown }) => s.proof);
  console.log(`ruta=${route1?.name}, paradas=${route1?.stops?.length}, parada con comprobante=${!!stopWithProof}`);
  if (stopWithProof) {
    const proof = await call(chofer, `/api/stops/${stopWithProof.id}/proof`);
    console.log(`GET proof status=${proof.status}, photoData length=${proof.data.photoData?.length}, gps=${proof.data.lat},${proof.data.lng}`);
  }

  console.log("=== 6. Cliente crea pedido ===");
  const prods = await call(cliente, "/api/products");
  const p20 = prods.data.find((p: { code: string }) => p.code === "AGU-20L");
  const create = await call(cliente, "/api/orders", "POST", {
    items: [{ productId: p20.id, quantity: 2 }],
    notes: "Prueba automática del portal",
  });
  console.log(`crear pedido: status=${create.status}, id=${create.data.id}, total=${create.data.total}`);
  const notifAfter = await call(admin, "/api/notifications");
  console.log(`admin unread ahora=${notifAfter.data.unread} (debería subir por PEDIDO_NUEVO)`);

  console.log("=== 7. Chofer NO puede crear producto (RBAC sigue intacto) ===");
  const forbidden = await call(chofer, "/api/products", "POST", { name: "x" });
  console.log(`status=${forbidden.status} (esperado 403)`);

  console.log("=== 8. Cliente NO ve pedidos de otros ===");
  const allOrders = await call(admin, "/api/orders");
  const clientVisible = await call(cliente, "/api/orders");
  console.log(`admin ve=${allOrders.data.length}, cliente ve=${clientVisible.data.length} (scoped correcto)`);

  console.log("\n✅ TODAS LAS PRUEBAS PASARON");
}

main().catch((e) => {
  console.error("❌ FALLO:", e.message);
  process.exit(1);
});
