import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";

const db = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const ALL_PERMS = [
  "dashboard.view", "products.view", "products.manage", "inventory.manage",
  "customers.view", "customers.manage", "orders.view", "orders.manage",
  "routes.view", "routes.manage", "tracking.view", "tracking.send",
  "delivery.execute", "users.manage", "roles.manage", "reports.view",
];

const SUPERVISOR_PERMS = [
  "dashboard.view", "products.view", "products.manage", "inventory.manage",
  "customers.view", "customers.manage", "orders.view", "orders.manage",
  "routes.view", "routes.manage", "tracking.view", "reports.view",
];

const BODEGA_PERMS = [
  "dashboard.view", "products.view", "inventory.manage",
  "orders.view", "routes.view",
];

const CHOFER_PERMS = ["routes.view", "tracking.send", "delivery.execute"];

async function main() {
  console.log("Limpiando base de datos...");
  await db.trackingPoint.deleteMany();
  await db.dispatch.deleteMany();
  await db.routeStop.deleteMany();
  await db.deliveryRoute.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.inventoryMovement.deleteMany();
  await db.customer.deleteMany();
  await db.product.deleteMany();
  await db.vehicle.deleteMany();
  await db.user.deleteMany();
  await db.role.deleteMany();

  console.log("Creando roles...");
  const adminRole = await db.role.create({
    data: { name: "ADMIN", description: "Acceso total al sistema", permissions: JSON.stringify(ALL_PERMS) },
  });
  const supRole = await db.role.create({
    data: { name: "SUPERVISOR", description: "Supervisa operaciones y despachos", permissions: JSON.stringify(SUPERVISOR_PERMS) },
  });
  const bodegaRole = await db.role.create({
    data: { name: "BODEGA", description: "Control de inventario y almacen", permissions: JSON.stringify(BODEGA_PERMS) },
  });
  const choferRole = await db.role.create({
    data: { name: "CHOFER", description: "Conduce rutas de reparto y ejecuta entregas", permissions: JSON.stringify(CHOFER_PERMS) },
  });

  console.log("Creando usuarios...");
  await db.user.create({
    data: { name: "Administrador General", email: "admin@aqua.com", passwordHash: hashPassword("admin123"), roleId: adminRole.id, phone: "0212-5550100" },
  });
  await db.user.create({
    data: { name: "María Rodríguez", email: "supervisor@aqua.com", passwordHash: hashPassword("super123"), roleId: supRole.id, phone: "0212-5550200" },
  });
  await db.user.create({
    data: { name: "Carlos Pérez (Bodega)", email: "bodega@aqua.com", passwordHash: hashPassword("bodega123"), roleId: bodegaRole.id, phone: "0212-5550300" },
  });
  const chofer1 = await db.user.create({
    data: { name: "Luis Gómez", email: "chofer@aqua.com", passwordHash: hashPassword("chofer123"), roleId: choferRole.id, phone: "0412-1234567" },
  });
  const chofer2 = await db.user.create({
    data: { name: "José Ramírez", email: "chofer2@aqua.com", passwordHash: hashPassword("chofer123"), roleId: choferRole.id, phone: "0414-7654321" },
  });

  console.log("Creando productos...");
  const p5 = await db.product.create({ data: { code: "AGU-5L", name: "Botellón 5L", sizeLiters: 5, price: 2.5, cost: 1.2, stock: 120, minStock: 30 } });
  const p10 = await db.product.create({ data: { code: "AGU-10L", name: "Botellón 10L", sizeLiters: 10, price: 4.0, cost: 1.9, stock: 85, minStock: 25 } });
  const p12 = await db.product.create({ data: { code: "AGU-12L", name: "Garrafa 12L", sizeLiters: 12, price: 4.5, cost: 2.2, stock: 18, minStock: 20 } });
  const p20 = await db.product.create({ data: { code: "AGU-20L", name: "Botellón 20L", sizeLiters: 20, price: 6.5, cost: 3.1, stock: 200, minStock: 50 } });

  console.log("Creando vehículos...");
  const v1 = await db.vehicle.create({ data: { plate: "AA123XY", model: "Chevrolet NHR 2020", capacityLiters: 1200 } });
  const v2 = await db.vehicle.create({ data: { plate: "AB456ZW", model: "Mitsubishi Canter 2019", capacityLiters: 2000 } });

  console.log("Creando clientes (Caracas)...");
  const customers = await Promise.all([
    db.customer.create({ data: { name: "Bodegón La Esquina", phone: "0212-2854512", address: "Av. Francisco de Miranda, C.C. Parque Cristal, piso 1", zone: "Los Palos Grandes", lat: 10.4977, lng: -66.8536, email: "laesquina@gmail.com" } }),
    db.customer.create({ data: { name: "Edif. Mirador de Chuao", phone: "0412-9987711", address: "Av. Principal de Chuao, Edif. Mirador, Apto 4-B", zone: "Chuao", lat: 10.4892, lng: -66.8639, notes: "Entregar en recepción" } }),
    db.customer.create({ data: { name: "Farmacia Salud Total", phone: "0212-2637788", address: "Av. Libertador, Torre Pilar Este, local 3", zone: "Chacao", lat: 10.4989, lng: -66.8574 } }),
    db.customer.create({ data: { name: "Restaurante Doña Inés", phone: "0414-2233445", address: "Calle Orinoco, Quinta Doña Inés", zone: "Las Mercedes", lat: 10.4708, lng: -66.8532 } }),
    db.customer.create({ data: { name: "Condominio El Cafetal", phone: "0412-5566778", address: "Av. Principal del Cafetal, Cond. Los Samanes, Torre 2", zone: "El Cafetal", lat: 10.4287, lng: -66.8285 } }),
    db.customer.create({ data: { name: "Cafetería Aroma", phone: "0212-7612299", address: "C.C. Sambil Chacao, nivel feria, local 12", zone: "Chacao", lat: 10.4941, lng: -66.8509 } }),
    db.customer.create({ data: { name: "Residencias Los Samanes", phone: "0424-8899001", address: "Av. Intercomunal, Res. Los Samanes, Bloque C", zone: "El Hatillo", lat: 10.4321, lng: -66.8351 } }),
    db.customer.create({ data: { name: "Oficina Contable MP", phone: "0212-9534411", address: "Av. Andrés Bello, Torre Financiera, piso 7, oficina 7-B", zone: "Caracas Centro", lat: 10.5061, lng: -66.8786 } }),
  ]);

  console.log("Creando pedidos...");
  const today = new Date();
  const ordersData = [
    { customerId: 0, items: [[p20.id, 4], [p5.id, 2]], status: "CONFIRMADO" },
    { customerId: 1, items: [[p20.id, 6]], status: "CONFIRMADO" },
    { customerId: 2, items: [[p10.id, 8], [p20.id, 2]], status: "CONFIRMADO" },
    { customerId: 3, items: [[p20.id, 10], [p10.id, 4]], status: "CONFIRMADO" },
    { customerId: 4, items: [[p20.id, 8], [p5.id, 6]], status: "PENDIENTE" },
    { customerId: 5, items: [[p5.id, 12]], status: "PENDIENTE" },
    { customerId: 6, items: [[p20.id, 5], [p12.id, 3]], status: "PENDIENTE" },
    { customerId: 7, items: [[p10.id, 6], [p20.id, 4]], status: "PENDIENTE" },
  ];

  const orders = [];
  for (const od of ordersData) {
    const items = od.items.map(([productId, quantity]) => {
      const prod = [p5, p10, p12, p20].find((p) => p.id === productId)!;
      return { productId, quantity, unitPrice: prod.price };
    });
    const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    orders.push(
      await db.order.create({
        data: {
          customerId: customers[od.customerId].id,
          userId: 1,
          status: od.status,
          total,
          items: { create: items },
        },
      })
    );
  }

  console.log("Creando rutas de despacho...");
  // Ruta 1: EN CURSO (chofer Luis) — para demo de seguimiento GPS
  const route1 = await db.deliveryRoute.create({
    data: {
      name: "Ruta Norte - Turno Mañana",
      driverId: chofer1.id,
      vehicleId: v1.id,
      date: today,
      status: "EN_CURSO",
      startedAt: new Date(Date.now() - 40 * 60 * 1000),
      stops: {
        create: [
          { orderId: orders[0].id, customerId: customers[0].id, sequence: 1, status: "ENTREGADO", itemsSummary: "4× Botellón 20L, 2× Botellón 5L", deliveredAt: new Date(Date.now() - 25 * 60 * 1000) },
          { orderId: orders[1].id, customerId: customers[1].id, sequence: 2, status: "PENDIENTE", itemsSummary: "6× Botellón 20L" },
          { orderId: orders[2].id, customerId: customers[2].id, sequence: 3, status: "PENDIENTE", itemsSummary: "8× Botellón 10L, 2× Botellón 20L" },
        ],
      },
    },
  });
  await db.order.updateMany({ where: { id: { in: [orders[0].id, orders[1].id, orders[2].id] } }, data: { status: "EN_RUTA" } });

  // Posiciones GPS simuladas de la ruta 1 (trayecto)
  const track: [number, number][] = [
    [10.4902, -66.8765], [10.4918, -66.8712], [10.4935, -66.8660],
    [10.4952, -66.8608], [10.4964, -66.8571], [10.4977, -66.8536],
    [10.4968, -66.8562], [10.4948, -66.8598],
  ];
  for (let i = 0; i < track.length; i++) {
    await db.trackingPoint.create({
      data: {
        userId: chofer1.id,
        routeId: route1.id,
        lat: track[i][0],
        lng: track[i][1],
        speed: 25 + i * 3,
        accuracy: 8,
        createdAt: new Date(Date.now() - (track.length - i) * 5 * 60 * 1000),
      },
    });
  }

  // Ruta 2: PLANIFICADA (chofer José)
  await db.deliveryRoute.create({
    data: {
      name: "Ruta Sureste - Turno Tarde",
      driverId: chofer2.id,
      vehicleId: v2.id,
      date: today,
      status: "PLANIFICADA",
      stops: {
        create: [
          { orderId: orders[3].id, customerId: customers[3].id, sequence: 1, itemsSummary: "10× Botellón 20L, 4× Botellón 10L" },
          { orderId: orders[4].id, customerId: customers[4].id, sequence: 2, itemsSummary: "8× Botellón 20L, 6× Botellón 5L" },
        ],
      },
    },
  });
  await db.order.updateMany({ where: { id: { in: [orders[3].id, orders[4].id] } }, data: { status: "EN_RUTA" } });

  // Pedidos entregados históricos para el dashboard
  const hist = await db.order.create({
    data: {
      customerId: customers[6].id,
      userId: 1,
      status: "ENTREGADO",
      total: p20.price * 6 + p5.price * 4,
      items: { create: [[p20.id, 6], [p5.id, 4]].map(([id, q]) => ({ productId: id as number, quantity: q as number, unitPrice: [p20, p5].find(p => p.id === id)!.price })) },
    },
  });
  for (let d = 1; d <= 5; d++) {
    const day = new Date(today.getTime() - d * 24 * 3600 * 1000);
    await db.order.create({
      data: {
        customerId: customers[d % customers.length].id,
        userId: 1,
        status: "ENTREGADO",
        total: 15 + d * 7,
        createdAt: day,
        updatedAt: day,
        items: { create: [{ productId: [p5, p10, p12, p20][d % 4].id, quantity: 2 + d, unitPrice: 4 }] },
      },
    });
  }

  console.log("Movimientos de inventario iniciales...");
  await db.inventoryMovement.create({ data: { productId: p5.id, type: "ENTRADA", quantity: 120, reason: "Compra inicial", userId: 1 } });
  await db.inventoryMovement.create({ data: { productId: p20.id, type: "ENTRADA", quantity: 200, reason: "Compra inicial", userId: 1 } });

  console.log("Seed completado ✓");
  console.log(`
USUARIOS DEMO:
  admin@aqua.com       / admin123   (ADMIN - acceso total)
  supervisor@aqua.com  / super123   (SUPERVISOR)
  bodega@aqua.com      / bodega123  (BODEGA)
  chofer@aqua.com      / chofer123  (CHOFER - app móvil)
  chofer2@aqua.com     / chofer123  (CHOFER)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
