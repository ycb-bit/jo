import { firebaseConfig } from "@/lib/firebase";

export const runtime = "nodejs";

export type AuthedUser = { uid: string; email: string; admin: boolean };

export async function getAuthedUser(req: Request): Promise<AuthedUser | null> {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try {
    const { verifyIdToken } = await import("@/lib/firebase-admin");
    const decoded = await verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email || "",
      admin: decoded.admin === true || decoded.role === "admin",
    };
  } catch {
    return null;
  }
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function errorJson(message: string, status = 400) {
  return json({ error: message }, status);
}

export { firebaseConfig };
