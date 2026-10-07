// Actualización no destructiva:
// 1. Crea las configuraciones por defecto (tabla Setting)
// 2. Agrega el permiso "settings.manage" al rol ADMIN (y a cualquier rol que tenga todos los permisos)
// 3. Muestra la cantidad de usuarios por rol para verificación
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const DEFAULTS: Record<string, string> = {
  systemName: "AquaGestión",
  logo: "",
  currency: "$",
  quickAccessThreshold: "1",
  sessionHours: "12",
  companyName: "",
  companyRif: "",
  companyPhone: "",
  companyEmail: "",
  companyAddress: "",
};

async function main() {
  console.log("Creando configuraciones por defecto...");
  for (const [key, value] of Object.entries(DEFAULTS)) {
    await db.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }

  console.log("Agregando permiso settings.manage a los roles administrativos...");
  const roles = await db.role.findMany();
  for (const role of roles) {
    let perms: string[] = [];
    try { perms = JSON.parse(role.permissions); } catch { perms = []; }
    const wasFullAdmin = perms.includes("users.manage") && perms.includes("roles.manage");
    if (perms.includes("settings.manage")) continue;
    // Lo reciben los roles que ya podían gestionar usuarios y roles (administradores)
    if (wasFullAdmin || role.name === "ADMIN") {
      perms.push("settings.manage");
      await db.role.update({ where: { id: role.id }, data: { permissions: JSON.stringify(perms) } });
      console.log(`  ✓ ${role.name}: +settings.manage`);
    }
  }

  const count = await db.setting.count();
  console.log(`OK — ${count} configuraciones en la base de datos.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
