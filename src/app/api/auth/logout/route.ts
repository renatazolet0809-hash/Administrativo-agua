import { SESSION_COOKIE, ok } from "@/lib/auth";

export async function POST() {
  const response = ok({ success: true });
  response.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`
  );
  return response;
}
