// Acceso rápido: cuentas guardadas por frecuencia de uso EN ESTE NAVEGADOR.
// Cada inicio de sesión exitoso incrementa el contador de la cuenta; cuando
// supera el umbral N (configurable en Configuración → Seguridad) aparece en
// el acceso rápido de la pantalla de login. Se puede eliminar cada cuenta.

export interface QuickAccount {
  email: string;
  name: string;
  roleName: string;
  count: number;       // ingresos desde este navegador
  lastUsed: string;    // ISO
  pass?: string;       // contraseña ofuscada (solo si el usuario marcó "recordar")
}

const KEY = "aqua_quick_access";

function readAll(): QuickAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAll(list: QuickAccount[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

function encodePass(pw: string): string {
  // Ofuscación simple (base64). Solo se guarda si el usuario lo autoriza;
  // recomendable únicamente en dispositivos personales.
  try { return btoa(encodeURIComponent(pw)); } catch { return undefined as unknown as string; }
}

export function decodePass(acc: QuickAccount): string | null {
  if (!acc.pass) return null;
  try { return decodeURIComponent(atob(acc.pass)); } catch { return null; }
}

/** Registra un ingreso exitoso. Si remember=true guarda/actualiza la contraseña. */
export function recordLogin(opts: {
  email: string;
  name: string;
  roleName: string;
  password?: string;   // undefined = no tocar la guardada
  remember: boolean;
}) {
  const list = readAll();
  const email = opts.email.trim().toLowerCase();
  const idx = list.findIndex((a) => a.email === email);
  const now = new Date().toISOString();

  if (idx >= 0) {
    const acc = list[idx];
    acc.count += 1;
    acc.lastUsed = now;
    acc.name = opts.name || acc.name;
    acc.roleName = opts.roleName || acc.roleName;
    if (opts.remember) {
      if (opts.password) acc.pass = encodePass(opts.password);
      // remember sin password nueva (ej. ingreso desde el acceso rápido): conserva la actual
    } else {
      delete acc.pass;
    }
  } else {
    const acc: QuickAccount = {
      email,
      name: opts.name,
      roleName: opts.roleName,
      count: 1,
      lastUsed: now,
    };
    if (opts.remember && opts.password) acc.pass = encodePass(opts.password);
    list.push(acc);
  }
  writeAll(list);
}

/** Cuentas que superan el umbral N de ingresos, ordenadas por uso reciente */
export function getQuickAccounts(threshold: number): QuickAccount[] {
  return readAll()
    .filter((a) => a.count > threshold)
    .sort((a, b) => (a.lastUsed < b.lastUsed ? 1 : -1));
}

/** Todas las cuentas registradas (aunque no alcancen el umbral) */
export function getAllTrackedAccounts(): QuickAccount[] {
  return readAll().sort((a, b) => (a.lastUsed < b.lastUsed ? 1 : -1));
}

/** Elimina una cuenta del acceso rápido */
export function removeQuickAccount(email: string) {
  writeAll(readAll().filter((a) => a.email !== email.trim().toLowerCase()));
}
