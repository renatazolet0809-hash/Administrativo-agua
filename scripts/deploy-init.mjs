/**
 * deploy-init.mjs — Inicialización automática de la base de datos al hacer deploy.
 *
 * Se ejecuta automáticamente en el build (ver package.json → "build"), ANTES de
 * `next build`, y es IDEMPOTENTE (seguro de ejecutar cuantas veces sea necesario):
 *
 *   1. SCHEMA   → si las tablas no existen, las crea (prisma db push).
 *                 Si ya existen, intenta una sincronización segura sin perder datos.
 *   2. DATOS    → si la base está vacía (sin roles), carga el seed completo.
 *                 Si ya hay datos base, NO los vuelve a cargar.
 *   3. DEMO     → garantiza que exista UN usuario demo por cada rol
 *                 (los crea solo si no existen; nunca duplica ni sobrescribe).
 *
 * Nunca interrumpe el deploy: ante un error de BD registra una advertencia
 * clara y termina con código 0.
 *
 * Variables de entorno que usa:
 *   DATABASE_URL / DIRECT_URL → conexión (Neon en producción)
 *   DEPLOY_PRISMA_SCHEMA      → (opcional) schema para `db push`;
 *                               por defecto prisma/schema.postgres.prisma
 *   SKIP_DEPLOY_INIT=1        → (opcional) omite toda la inicialización
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";
import { execSync } from "node:child_process";

const db = new PrismaClient();
const SCHEMA = process.env.DEPLOY_PRISMA_SCHEMA || "prisma/schema.postgres.prisma";
const DEMO_PASSWORD = "demo1234";

// ---- Permisología por rol (espejo de scripts/seed.ts) ----
const ALL_PERMS = [
  "dashboard.view", "products.view", "products.manage", "inventory.manage",
  "customers.view", "customers.manage", "orders.view", "orders.manage",
  "routes.view", "routes.manage", "tracking.view", "tracking.send",
  "delivery.execute", "users.manage", "roles.manage", "reports.view", "settings.manage",
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
const CLIENTE_PERMS = ["products.view", "orders.view", "orders.create"];

const ROLE_DEFS = [
  { name: "ADMIN", description: "Acceso total al sistema", permissions: ALL_PERMS },
  { name: "SUPERVISOR", description: "Supervisa operaciones y despachos", permissions: SUPERVISOR_PERMS },
  { name: "BODEGA", description: "Control de inventario y almacen", permissions: BODEGA_PERMS },
  { name: "CHOFER", description: "Conduce rutas de reparto y ejecuta entregas", permissions: CHOFER_PERMS },
  { name: "CLIENTE", description: "Cliente del portal web: consulta catálogo y hace sus pedidos", permissions: CLIENTE_PERMS },
];

// ---- Usuarios demo: uno nuevo por cada rol ----
const DEMO_USERS = [
  { name: "Gerente Demo", email: "demo.admin@aqua.com", phone: "0212-5550001", role: "ADMIN" },
  { name: "Supervisora Demo", email: "demo.supervisor@aqua.com", phone: "0212-5550002", role: "SUPERVISOR" },
  { name: "Bodeguero Demo", email: "demo.bodega@aqua.com", phone: "0212-5550003", role: "BODEGA" },
  { name: "Chofer Demo", email: "demo.chofer@aqua.com", phone: "0412-5550004", role: "CHOFER" },
  { name: "Cliente Demo", email: "demo.cliente@aqua.com", phone: "0412-5550005", role: "CLIENTE",
    customer: {
      name: "Cliente Demo (Portal Web)", phone: "0412-5550005",
      address: "Av. Demo, Edif. Demostración, Apto 1-A", zone: "Chacao",
      lat: 10.4989, lng: -66.8574, email: "demo.cliente@aqua.com",
      notes: "Usuario demo del portal web creado por deploy-init",
    } },
];

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function run(cmd, { allowFail = false } = {}) {
  try {
    execSync(cmd, { stdio: ["ignore", "pipe", "pipe"], env: process.env });
    return true;
  } catch (e) {
    if (allowFail) {
      console.warn(`⚠️  Omitido (falló sin bloquear el deploy): ${cmd.split("&&")[0].trim()}`);
      if (e.stderr) console.warn(String(e.stderr).split("\n").slice(0, 6).join("\n"));
      return false;
    }
    throw e;
  }
}

async function tablesExist() {
  try {
    await db.role.count();
    return true;
  } catch (e) {
    if (e?.code === "P2021") return false; // "table does not exist" en Prisma
    throw e;
  }
}

async function stepSchema() {
  const exists = await tablesExist();
  if (exists) {
    console.log("▶ Tablas ya existen: sincronización de schema segura (sin pérdida de datos)…");
    // Si el cambio de modelos exigiera borrar columnas, falla y se avisa (no bloquea)
    run(`npx prisma db push --schema ${SCHEMA} --skip-generate`, { allowFail: true });
  } else {
    console.log("▶ Base de datos vacía: creando tablas (prisma db push)…");
    run(`npx prisma db push --schema ${SCHEMA} --skip-generate --accept-data-loss`);
  }
}

async function baseDataExists() {
  return (await db.role.count()) > 0;
}

async function stepSeed() {
  if (await baseDataExists()) {
    console.log("▶ Datos base ya presentes: NO se vuelven a cargar (seed omitido).");
    return;
  }
  console.log("▶ Base sin datos: cargando datos base (seed completo)…");
  run("npx tsx scripts/seed.ts");
}

async function stepDemoUsers() {
  console.log("▶ Garantizando 1 usuario demo por rol (solo crea los que falten)…");
  for (const def of ROLE_DEFS) {
    // Rol: solo se crea si falta. Si existe, se respeta tal cual (no se toca).
    let role = await db.role.findUnique({ where: { name: def.name } });
    if (!role) {
      role = await db.role.create({
        data: { name: def.name, description: def.description, permissions: JSON.stringify(def.permissions) },
      });
      console.log(`   + Rol ${def.name} creado`);
    }

    const u = DEMO_USERS.find((x) => x.role === def.name);
    if (!u) continue;

    const existing = await db.user.findUnique({ where: { email: u.email } });
    if (existing) {
      console.log(`   = Usuario demo ${u.email} ya existe (omitido)`);
      continue;
    }

    let customerId;
    if (u.customer) {
      const cust = await db.customer.create({ data: u.customer });
      customerId = cust.id;
    }
    await db.user.create({
      data: {
        name: u.name, email: u.email, passwordHash: hashPassword(DEMO_PASSWORD),
        phone: u.phone, roleId: role.id, ...(customerId ? { customerId } : {}),
      },
    });
    console.log(`   + Usuario demo ${u.email} (${def.name}) creado`);
  }
}

async function main() {
  if (process.env.SKIP_DEPLOY_INIT === "1") {
    console.log("deploy-init: omitido (SKIP_DEPLOY_INIT=1)");
    return;
  }
  console.log("════════ deploy-init: inicialización de la base de datos ════════");
  try {
    await stepSchema();
    await stepSeed();
    await stepDemoUsers();
    const [roles, users, customers, products] = await Promise.all([
      db.role.count(), db.user.count(), db.customer.count(), db.product.count(),
    ]);
    console.log(`════════ deploy-init OK → roles:${roles} usuarios:${users} clientes:${customers} productos:${products} ════════`);
    console.log("   Cuentas demo (contraseña: demo1234):");
    for (const u of DEMO_USERS) console.log(`     ${u.email.padEnd(28)} → ${u.role}`);
  } catch (e) {
    console.warn("⚠️  deploy-init no pudo completarse (el deploy continúa):");
    console.warn(String(e?.message || e).split("\n").slice(0, 10).join("\n"));
    console.warn("   Verifique DATABASE_URL/DIRECT_URL y ejecute `npm run deploy:init` manualmente.");
  } finally {
    await db.$disconnect();
  }
}

main();
