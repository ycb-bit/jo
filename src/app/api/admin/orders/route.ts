import { NextRequest } from "next/server";
import { getAuthedUser, json, errorJson } from "@/lib/api-utils";
import { getAdminApp } from "@/lib/firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

/** Admin order actions: verify receipt, reject, ship, deliver. */
export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user?.admin) return errorJson("Forbidden", 403);

  const body = await req.json().catch(() => null);
  const { orderId, action, note } = body || {};
  if (!orderId || !action) return errorJson("Missing orderId or action");

  const db = getFirestore(await getAdminApp());
  const ref = db.collection("orders").doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) return errorJson("Order not found", 404);
  const order = snap.data()!;
  const now = Date.now();

  if (action === "verify") {
    if (order.status !== "verifying" && order.status !== "receipt_uploaded") {
      return errorJson("Order is not in a verifiable state", 409);
    }
    // Atomic stock decrement inside a transaction.
    await db.runTransaction(async (tx) => {
      const itemRefs = order.items.map((i: { productId: string }) =>
        db.collection("products").doc(i.productId)
      );
      const itemDocs = await tx.getAll(...itemRefs);
      itemDocs.forEach((doc, idx) => {
        if (!doc.exists) return;
        const item = order.items[idx];
        const key = `${item.color}|${item.size}`;
        const data = doc.data() as { stock?: Record<string, number> } | undefined;
        const stock = { ...(data?.stock || {}) };
        stock[key] = Math.max(0, (stock[key] ?? 0) - item.qty);
        tx.update(doc.ref, { stock });
      });
      tx.update(ref, {
        status: "confirmed",
        history: FieldValue.arrayUnion({ status: "confirmed", at: now, note: note || "Payment verified" }),
        updatedAt: now,
      });
    });
    return json({ ok: true, status: "confirmed" });
  }

  if (action === "reject") {
    await ref.update({
      status: "rejected",
      rejectionReason: note || "Receipt could not be verified",
      history: FieldValue.arrayUnion({ status: "rejected", at: now, note: note || "Receipt rejected" }),
      updatedAt: now,
    });
    return json({ ok: true, status: "rejected" });
  }

  if (action === "ship" || action === "deliver" || action === "cancel") {
    const status = action === "ship" ? "shipped" : action === "deliver" ? "delivered" : "cancelled";
    await ref.update({
      status,
      trackingNote: note || "",
      history: FieldValue.arrayUnion({ status, at: now, note: note || "" }),
      updatedAt: now,
    });
    return json({ ok: true, status });
  }

  return errorJson("Unknown action");
}
