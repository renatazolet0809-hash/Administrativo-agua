// Catálogo de configuraciones del sistema (clave/valor en BD)
// public: la clave se puede leer sin sesión (pantalla de login)

import { db } from "@/lib/db";
import { ApiError } from "@/lib/auth";

interface SettingDef {
  label: string;
  defaultValue: string;
  public: boolean;
  maxLength?: number;
  validate?: (v: string) => string; // devuelve el valor normalizado o lanza ApiError
}

export const SETTING_DEFS: Record<string, SettingDef> = {
  systemName: {
    label: "Nombre del sistema",
    defaultValue: "AquaGestión",
    public: true,
    maxLength: 40,
    validate: (v) => {
      if (!v.trim()) throw new ApiError("El nombre del sistema no puede estar vacío", 400);
      return v.trim();
    },
  },
  logo: {
    label: "Logo (imagen)",
    defaultValue: "",
    public: true,
    maxLength: 400_000, // dataURL PNG ~192px
    validate: (v) => {
      if (v && !v.startsWith("data:image/")) {
        throw new ApiError("El logo debe ser una imagen válida", 400);
      }
      return v;
    },
  },
  currency: {
    label: "Símbolo de moneda",
    defaultValue: "$",
    public: true,
    maxLength: 6,
    validate: (v) => v.trim() || "$",
  },
  quickAccessThreshold: {
    label: "Ingresos necesarios para mostrar una cuenta en el acceso rápido",
    defaultValue: "1",
    public: true,
    validate: (v) => {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > 20) {
        throw new ApiError("El umbral de acceso rápido debe ser un número entre 0 y 20", 400);
      }
      return String(n);
    },
  },
  sessionHours: {
    label: "Duración de la sesión (horas)",
    defaultValue: "12",
    public: false,
    validate: (v) => {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 72) {
        throw new ApiError("La duración de sesión debe estar entre 1 y 72 horas", 400);
      }
      return String(n);
    },
  },
  companyName: { label: "Razón social", defaultValue: "", public: false, maxLength: 80 },
  companyRif: { label: "RIF", defaultValue: "", public: false, maxLength: 20 },
  companyPhone: { label: "Teléfono de la empresa", defaultValue: "", public: false, maxLength: 30 },
  companyEmail: { label: "Correo de la empresa", defaultValue: "", public: false, maxLength: 80 },
  companyAddress: { label: "Dirección de la empresa", defaultValue: "", public: false, maxLength: 200 },
};

export type SettingKey = keyof typeof SETTING_DEFS;
export const SETTING_KEYS = Object.keys(SETTING_DEFS) as SettingKey[];
export const PUBLIC_SETTING_KEYS = SETTING_KEYS.filter((k) => SETTING_DEFS[k].public);

/** Lee todas las configuraciones completando con valores por defecto */
export async function getSettings(): Promise<Record<string, string>> {
  const rows = await db.setting.findMany();
  const map: Record<string, string> = {};
  for (const key of SETTING_KEYS) map[key] = rows.find((r) => r.key === key)?.value ?? SETTING_DEFS[key].defaultValue;
  return map;
}

/** Guarda un lote de configuraciones validando claves y valores */
export async function saveSettings(values: Record<string, string>): Promise<void> {
  for (const [key, raw] of Object.entries(values)) {
    const def = SETTING_DEFS[key];
    if (!def) throw new ApiError(`Configuración desconocida: ${key}`, 400);
    const value = String(raw ?? "");
    if (def.maxLength && value.length > def.maxLength) {
      throw new ApiError(`"${def.label}" excede el tamaño máximo permitido`, 400);
    }
    const final = def.validate ? def.validate(value) : value;
    await db.setting.upsert({
      where: { key },
      update: { value: final },
      create: { key, value: final },
    });
  }
}

/** Filtra un mapa de settings a solo las claves públicas */
export function publicSettings(all: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of PUBLIC_SETTING_KEYS) out[key] = all[key];
  return out;
}
