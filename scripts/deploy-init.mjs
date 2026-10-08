#!/usr/bin/env node
/**
 * deploy-init.mjs — Inicialización automática de la base de datos al hacer deploy.
 *
 * Se ejecuta automáticamente en el build (ver package.json → "build"), ANTES de
 * `next build`, y es IDEMPOTENTE (seguro de ejecutar cuantas veces sea necesario):
 *
 *   PASO 1 · SCHEMA  → si las tablas NO existen, las crea (prisma db push).
 *                      Si ya existen, intenta una sincronización segura sin perder datos.
 *   PASO 2 · DATOS   → si la base está vacía (sin roles), carga el seed completo.
 *                      Si ya hay datos base, NO los vuelve a cargar (seed omitido).
 *   PASO 3 · DEMO    → garantiza UN usuario demo por cada rol
 *                      (crea solo los que falten; nunca duplica ni sobrescribe).
 *
 * Seguridad:
 *   - Si faltan variables de conexión o no se pueden crear las tablas, el build
 *     FALLA con un mensaje claro (es mejor que publicar una app rota con P2021).
 *   - Errores de seed / usuarios demo solo advierten: no bloquean el deploy.
 *   - SKIP_DEPLOY_INIT=1 omite toda la inicialización (emergencias).
 *
 * Variables de entorno que usa:
 *   DATABASE_URL  → conexión (Neon pooled en producción; file: en desarrollo)
 *   DIRECT_URL    → conexión directa para DDL (Neon). Si falta, se intenta
 *                   crear las tablas por la pooled como respaldo.
 *   DEPLOY_PRISMA_SCHEMA → (opcional) schema para `db push`;
 *                   por defecto prisma/schema.postgres.prisma
 *   SKIP_DEPLOY_INIT=1   → (opcional) omite toda la inicialización
 */
import { execSync } from "node:child_process";
import { randomBytes, scryptSync } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const SCHEMA_PG = "prisma/schema.postgres.prisma";
const SCHEMA_SQLITE = "prisma/schema.prisma";
const FALLBACK_SCHEMA_PATH = "node_modules/.deploy-init-schema.prisma";
const DEMO_PASSWORD = "demo1234";

const DATABASE_URL = process.env.DATABASE_URL || "";
const DIRECT_URL = process.env.DIRECT_URL || "";
const IS_PG = /^postgres(ql)?:\/\//i.test(DATABASE_URL);

const SCHEMA =
  process.env.DEPLOY_PRISMA_SCHEMA || (IS_PG ? SCHEMA_PG : SCHEMA_SQLITE);

let db = null; // PrismaClient (se importa tras asegurar el cliente correcto)

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

// ==================== utilidades ====================

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function maskHost(url) {
  try {
    const u = new URL(url.replace(/^postgres(ql)?:\/\//i, "postgresql://"));
    return `${u.hostname}${u.port ? ":" + u.port : ""}/${u.pathname.replace(/^\//, "")}`;
  } catch {
    return url.startsWith("file:") ? "SQLite local" : "(desconocido)";
  }
}

function run(cmd, { allowFail = false } = {}) {
  try {
    execSync(cmd, { stdio: ["ignore", "pipe", "pipe"], env: process.env });
    return true;
  } catch (e) {
    if (allowFail) {
      console.warn(`⚠️  Paso omitido (no bloquea el deploy): ${cmd.split("&&")[0].trim()}`);
      const errText = String(e?.stderr || e?.message || "").split("\n").filter(Boolean).slice(0, 6).join("\n");
      if (errText) console.warn(errText);
      return false;
    }
    throw e;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Ejecuta fn reintentando ante errores transitorios de conexión (Neon cold start). */
async function withRetry(fn, attempts = 3, delayMs = 2500) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const transient =
        ["P1001", "P1000", "P1002", "P1017", "P2024"].includes(e?.code) ||
        /connect|timeout|timed out|ECONNREFUSED|ETIMEDOUT|terminated|cleared|socket/i.test(String(e?.message || ""));
      if (!transient || i === attempts) throw e;
      console.warn(`   ⏳ Conexión no lista (intento ${i}/${attempts}), reintentando en ${delayMs / 1000}s…`);
      await sleep(delayMs);
    }
  }
  throw lastErr;
}

// ==================== cliente Prisma correcto ====================

function generatedProvider() {
  const f = "node_modules/.prisma/client/schema.prisma";
  if (!existsSync(f)) return null;
  const m = readFileSync(f, "utf8").match(/provider\s*=\s*"(sqlite|postgresql)"/);
  return m ? m[1] : null;
}

/** Asegura que el cliente generado coincida con DATABASE_URL (pg vs sqlite). */
async function ensureClient() {
  const target = IS_PG ? "postgresql" : "sqlite";
  const current = generatedProvider();
  if (current !== target) {
    const schema = IS_PG ? SCHEMA_PG : SCHEMA_SQLITE;
    console.log(`   Cliente Prisma desactualizado (${current || "ausente"} → ${target}). Regenerando…`);
    run(`npx prisma generate --schema ${schema}`);
  }
  const { PrismaClient } = await import("@prisma/client");
  db = new PrismaClient();
}

// ==================== PASO 1 · SCHEMA ====================

async function tablesExist() {
  try {
    await withRetry(() => db.role.count());
    return true;
  } catch (e) {
    if (e?.code === "P2021") return false; // tabla no existe
    if (e?.code === "P2022") return true;  // columna falta → tabla existe, requiere sync
    throw e;
  }
}

/** Si falta DIRECT_URL, genera un schema sin directUrl para intentar el DDL por la pooled. */
function prepareSchemaForPush() {
  if (IS_PG && !DIRECT_URL && !process.env.DEPLOY_PRISMA_SCHEMA) {
    const original = readFileSync(SCHEMA_PG, "utf8");
    const stripped = original
      .split("\n")
      .filter((l) => !/directUrl/.test(l))
      .join("\n");
    writeFileSync(FALLBACK_SCHEMA_PATH, stripped);
    console.warn("   ⚠️  DIRECT_URL no está definida: se intentará crear las tablas por la conexión pooled.");
    console.warn("      Recomendado: agrega DIRECT_URL (cadena directa de Neon) en Vercel → Environment Variables.");
    return FALLBACK_SCHEMA_PATH;
  }
  return SCHEMA;
}

async function stepSchema() {
  const exists = await tablesExist();
  const schemaForPush = prepareSchemaForPush();
  if (exists) {
    console.log("   Tablas ya existen: sincronización segura (sin pérdida de datos)…");
    run(`npx prisma db push --schema ${schemaForPush} --skip-generate`, { allowFail: true });
    console.log("   ✅ Schema verificado/sincronizado.");
  } else {
    console.log("   Base de datos vacía: creando tablas (prisma db push)…");
    try {
      run(`npx prisma db push --schema ${schemaForPush} --skip-generate --accept-data-loss`);
      console.log("   ✅ Tablas creadas correctamente.");
    } catch (e) {
      const errText = String(e?.stderr || e?.message || "").split("\n").filter(Boolean).slice(-8).join("\n");
      throw new Error(
        `No se pudieron crear las tablas en ${maskHost(DATABASE_URL)}.\n` +
        `   Revisa que DATABASE_URL y DIRECT_URL (cadena directa de Neon) estén bien configuradas.\n` +
        `${errText}`
      );
    }
  }
}

// ==================== PASO 2 · DATOS BASE ====================

async function stepSeed() {
  const roleCount = await db.role.count();
  if (roleCount > 0) {
    console.log(`   Datos base ya presentes (${roleCount} roles): NO se vuelven a cargar. Seed omitido.`);
    return;
  }
  console.log("   Base sin datos: cargando datos base (seed completo)…");
  const ok = run("npx tsx scripts/seed.ts", { allowFail: true });
  if (!ok) console.warn("   ⚠️  El seed no pudo ejecutarse; la app funcionará pero sin datos demo de catálogo.");
}

// ==================== PASO 3 · USUARIOS DEMO ====================

async function stepDemoUsers() {
  console.log("   Garantizando 1 usuario demo por rol (solo crea los que falten)…");
  for (const def of ROLE_DEFS) {
    // Rol: solo se crea si falta. Si existe, se respeta tal cual (no se toca).
    let role = await db.role.findUnique({ where: { name: def.name } });
    if (!role) {
      role = await db.role.create({
        data: { name: def.name, description: def.description, permissions: JSON.stringify(def.permissions) },
      });
      console.log(`   + Rol ${def.name} creado (con sus ${def.permissions.length} permisos)`);
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

// ==================== flujo principal ====================

function hardFail(message) {
  console.error("\n──────────────────────────────────────────────────────");
  console.error("❌ deploy-init: ERROR CRÍTICO — el build se detiene.");
  console.error(message);
  console.error("──────────────────────────────────────────────────────");
  console.error("(Para omitir la inicialización y desplegar igual: SKIP_DEPLOY_INIT=1)");
  process.exit(1);
}

async function main() {
  if (process.env.SKIP_DEPLOY_INIT === "1") {
    console.log("deploy-init: omitido (SKIP_DEPLOY_INIT=1)");
    return;
  }
  console.log("════════ deploy-init ▸ inicialización automática de la base de datos ════════");
  console.log(`   Destino: ${maskHost(DATABASE_URL || "(sin DATABASE_URL)")} · ${IS_PG ? "PostgreSQL/Neon" : "SQLite"}`);

  // ---- Preflight: variables de conexión ----
  if (!DATABASE_URL) {
    hardFail("DATABASE_URL no está definida.\n   Agrégala en Vercel → Settings → Environment Variables (cadena pooled de Neon).");
  }

  // ---- Crítico: conexión y creación de tablas (detienen el build) ----
  try {
    await ensureClient();
    await withRetry(() => db.$connect(), 4, 3000);
  } catch (e) {
    hardFail(
      `No se pudo conectar a la base de datos (${maskHost(DATABASE_URL)}).\n` +
      `   Error: ${String(e?.message || e).split("\n")[0]}\n` +
      `   Revisa DATABASE_URL (cadena pooled de Neon) en Vercel → Environment Variables.`
    );
  }

  try {
    console.log("▶ PASO 1/3 · SCHEMA (tablas)");
    await stepSchema();
  } catch (e) {
    hardFail(String(e?.message || e));
  }

  // ---- No crítico: datos (solo advierten, el deploy continúa) ----
  try {
    console.log("▶ PASO 2/3 · DATOS BASE (seed idempotente)");
    await stepSeed();
  } catch (e) {
    console.warn("⚠️  Seed omitido por error (no bloquea el deploy):", String(e?.message || e).split("\n")[0]);
  }

  try {
    console.log("▶ PASO 3/3 · USUARIOS DEMO (uno por rol)");
    await stepDemoUsers();
  } catch (e) {
    console.warn("⚠️  Usuarios demo incompletos por error (no bloquea el deploy):", String(e?.message || e).split("\n")[0]);
  }

  try {
    const [roles, users, customers, products] = await Promise.all([
      db.role.count(), db.user.count(), db.customer.count(), db.product.count(),
    ]);
    console.log(`════════ deploy-init OK → roles:${roles} usuarios:${users} clientes:${customers} productos:${products} ════════`);
    console.log("   Cuentas demo (contraseña: demo1234):");
    for (const u of DEMO_USERS) console.log(`     ${u.email.padEnd(28)} → ${u.role}`);
  } catch {
    /* conteo final informativo: no bloquea */
  }
  if (db) await db.$disconnect().catch(() => {});
}

main();
