import { NextRequest } from "next/server";
import { getSessionUser, ok } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 });
  return ok(user);
}
