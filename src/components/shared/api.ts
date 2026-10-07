"use client";

const TOKEN_KEY = "aqua_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function api<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(path, {
    method: options.method || "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      clearToken();
      window.dispatchEvent(new Event("aqua:unauthorized"));
    }
    throw new Error((data as { error?: string }).error || "Error en la solicitud");
  }
  return data as T;
}

// Formateo
export function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function fmtDate(d: string | Date): string {
  return new Date(d).toLocaleString("es-VE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtDay(d: string | Date): string {
  return new Date(d).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  CONFIRMADO: "Confirmado",
  EN_RUTA: "En ruta",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
  PLANIFICADA: "Planificada",
  EN_CURSO: "En curso",
  COMPLETADA: "Completada",
  EN_CAMINO: "En camino",
  NO_ENTREGADO: "No entregado",
  CARGADO: "Cargado",
  RETORNADO: "Retornado",
};

export const STATUS_COLORS: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800 border-amber-200",
  CONFIRMADO: "bg-sky-100 text-sky-800 border-sky-200",
  EN_RUTA: "bg-violet-100 text-violet-800 border-violet-200",
  ENTREGADO: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CANCELADO: "bg-red-100 text-red-800 border-red-200",
  PLANIFICADA: "bg-amber-100 text-amber-800 border-amber-200",
  EN_CURSO: "bg-violet-100 text-violet-800 border-violet-200",
  COMPLETADA: "bg-emerald-100 text-emerald-800 border-emerald-200",
  EN_CAMINO: "bg-sky-100 text-sky-800 border-sky-200",
  NO_ENTREGADO: "bg-red-100 text-red-800 border-red-200",
};

// Distancia Haversine en km
export function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const la1 = (a[0] * Math.PI) / 180;
  const la2 = (b[0] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
