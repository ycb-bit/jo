import { NextRequest } from "next/server";
import { getAuthedUser, json, errorJson } from "@/lib/api-utils";
import { getAdminApp } from "@/lib/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

export const runtime = "nodejs";

const DEFAULTS = {
  currency: "USD",
  handlingFee: 0,
  paymentMethods: [],
  categories: ["outerwear", "knitwear", "tops", "bottoms", "accessories"],
  announcement: "Free worldwide shipping — hand-finished in small batches",
};

export async function GET(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user?.admin) return errorJson("Forbidden", 403);
  const db = getFirestore(await getAdminApp());
  const snap = await db.collection("settings").doc("store").get();
  return json({ settings: { ...DEFAULTS, ...(snap.data() || {}) } });
}

export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user?.admin) return errorJson("Forbidden", 403);
  const body = await req.json().catch(() => null);
  if (!body?.settings) return errorJson("Missing settings");
  const db = getFirestore(await getAdminApp());
  const clean = { ...DEFAULTS, ...body.settings };
  await db.collection("settings").doc("store").set(clean, { merge: true });
  return json({ ok: true, settings: clean });
}
