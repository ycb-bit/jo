import { NextRequest } from "next/server";
import { getAuthedUser, json, errorJson } from "@/lib/api-utils";
import { getAdminApp } from "@/lib/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return errorJson("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body?.items || !Array.isArray(body.items) || body.items.length === 0) {
    return errorJson("Cart is empty");
  }
  if (!body.shippingAddress?.line1 || !body.shippingAddress?.city) {
    return errorJson("Shipping address incomplete");
  }

  const admin = await getAdminApp();
  const db = getFirestore(admin);
  const settingsSnap = await db.collection("settings").doc("store").get();
  const settings = settingsSnap.data() || {};
  const currency = settings.currency || "USD";

  const subtotal = body.items.reduce(
    (a: number, i: { unitPrice: number; qty: number }) => a + i.unitPrice * i.qty,
    0
  );
  // server-side truth: what you see is what you pay — no shipping, no fees
  const total = subtotal;
  const now = Date.now();
  const ref = makeOrderRef();

  const order = {
    userId: user.uid,
    email: user.email,
    items: body.items,
    subtotal,
    total,
    currency,
    status: "awaiting_payment",
    shippingAddress: body.shippingAddress,
    paymentMethodId: typeof body.paymentMethodId === "string" ? body.paymentMethodId : "",
    paymentMethodName: typeof body.paymentMethodName === "string" ? body.paymentMethodName : "",
    ref,
    history: [{ status: "awaiting_payment", at: now, note: "Order created" }],
    createdAt: now,
    updatedAt: now,
  };

  const doc = await db.collection("orders").add(order);
  return json({ orderId: doc.id, ref, total, currency });
}

export async function GET(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return errorJson("Unauthorized", 401);
  const admin = await getAdminApp();
  const db = getFirestore(admin);
  const snap = await db
    .collection("orders")
    .where("userId", "==", user.uid)
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();
  return json({ orders: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
}

function makeOrderRef() {
  const t = Date.now().toString(36).toUpperCase().slice(-5);
  const r = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `JO-${t}${r}`;
}
