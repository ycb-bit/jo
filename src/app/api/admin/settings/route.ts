import { NextRequest } from "next/server";
import { getAuthedUser, json, errorJson } from "@/lib/api-utils";
import { getAdminApp } from "@/lib/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

export const runtime = "nodejs";

const DEFAULTS = {
  currency: "ETB",
  handlingFee: 0,
  paymentMethods: [],
  categories: ["outerwear", "knitwear", "tops", "bottoms", "accessories"],
  announcement: "Free worldwide shipping — hand-finished in small batches",
};

const ALLOWED = ["currency", "handlingFee", "paymentMethods", "categories", "announcement"] as const;
type AllowedKey = (typeof ALLOWED)[number];

export async function GET(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user?.admin) return errorJson("Forbidden", 403);
  const db = getFirestore(await getAdminApp());
  const snap = await db.collection("settings").doc("store").get();
  return json({ settings: { ...DEFAULTS, ...(snap.data() || {}) } });
}

/**
 * Partial save. Whatever the caller sends is the only thing written, so adding
 * a category cannot quietly overwrite payment methods the admin has not saved
 * yet (or the reverse). Each key is validated before it touches Firestore.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user?.admin) return errorJson("Forbidden", 403);
  const body = await req.json().catch(() => null);
  const incoming = body?.settings;
  if (!incoming || typeof incoming !== "object") return errorJson("Missing settings");

  const patch: Partial<Record<AllowedKey, unknown>> = {};

  if (Array.isArray(incoming.categories)) {
    const seen = new Set<string>();
    const categories: string[] = [];
    for (const raw of incoming.categories) {
      if (typeof raw !== "string") continue;
      const value = raw.trim().slice(0, 60);
      const key = value.toLowerCase();
      if (!value || seen.has(key)) continue;
      seen.add(key);
      categories.push(value);
    }
    patch.categories = categories.slice(0, 200);
  }

  if (Array.isArray(incoming.paymentMethods)) {
    patch.paymentMethods = incoming.paymentMethods
      .filter((m: unknown) => m && typeof m === "object")
      .slice(0, 20);
  }

  if (typeof incoming.currency === "string" && incoming.currency.trim()) {
    patch.currency = incoming.currency.trim().toUpperCase().slice(0, 8);
  }

  if (incoming.handlingFee != null && Number.isFinite(Number(incoming.handlingFee))) {
    patch.handlingFee = Math.max(0, Number(incoming.handlingFee));
  }

  if (typeof incoming.announcement === "string") {
    patch.announcement = incoming.announcement.slice(0, 240);
  }

  if (!Object.keys(patch).length) return errorJson("Nothing to save");

  const db = getFirestore(await getAdminApp());
  await db.collection("settings").doc("store").set(patch, { merge: true });
  return json({ ok: true, settings: patch });
}
