import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { parsePermissions } from "@/lib/permissions";

const SECRET = process.env.AUTH_SECRET || "aqua-despacho-secret-key-2026";
export const SESSION_COOKIE = "aqua_session";
const TOKEN_TTL_MS = 1000 * 60 * 60 * 12; // 12 horas

// ---------- Password hashing (scrypt) ----------

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

// ---------- Token (HMAC firmado, tipo JWT) ----------

interface TokenPayload {
  userId: number;
  exp: number;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function signToken(userId: number, ttlMs: number = TOKEN_TTL_MS): string {
  const payload: TokenPayload = { userId, exp: Date.now() + ttlMs };
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyToken(token: string): TokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = createHmac("sha256", SECRET).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as TokenPayload;
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------- Sesión ----------

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  roleId: number;
  roleName: string;
  customerId: number | null;
  permissions: string[];
}

export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  // 1. Authorization: Bearer <token> (para la app móvil)
  // 2. Cookie de sesión (para la web)
  let token: string | undefined;
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  }
  if (!token) {
    const cookieStore = await cookies();
    token = cookieStore.get(SESSION_COOKIE)?.value;
  }
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    include: { role: true },
  });
  if (!user || !user.active) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    roleId: user.roleId,
    roleName: user.role.name,
    customerId: user.customerId,
    permissions: parsePermissions(user.role.permissions),
  };
}

export function hasPermission(user: SessionUser, permission: string): boolean {
  return user.permissions.includes(permission);
}

// ---------- Helpers para las rutas API ----------

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function requireAuth(request: Request): Promise<SessionUser> {
  const user = await getSessionUser(request);
  if (!user) throw new ApiError("No autenticado", 401);
  return user;
}

export async function requirePermission(request: Request, permission: string): Promise<SessionUser> {
  const user = await requireAuth(request);
  if (!hasPermission(user, permission)) {
    throw new ApiError("No tiene permisos para esta acción", 403);
  }
  return user;
}

export function jsonError(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "Error interno del servidor" }, { status: 500 });
}

export function ok(data: unknown, status = 200) {
  return Response.json(data, { status });
}
