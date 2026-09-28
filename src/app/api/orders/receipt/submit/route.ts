import { NextRequest } from "next/server";
import { getAuthedUser, json, errorJson } from "@/lib/api-utils";
import { getAdminApp } from "@/lib/firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return errorJson("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  const { orderId, receiptRef } = body || {};
  if (!orderId || typeof receiptRef !== "string" || receiptRef.length < 3) {
    return errorJson("Missing orderId or receipt reference");
  }

  const admin = await getAdminApp();
  const db = getFirestore(admin);
  const orderDoc = await db.collection("orders").doc(orderId).get();
  if (!orderDoc.exists) return errorJson("Order not found", 404);
  const order = orderDoc.data()!;
  if (order.userId !== user.uid && !user.admin) return errorJson("Forbidden", 403);
  if (!["awaiting_payment", "rejected"].includes(order.status)) {
    return errorJson("Order is not awaiting payment", 409);
  }
  if (!order.receiptData && !order.receiptUrl) return errorJson("Upload a receipt image first");

  const now = Date.now();
  await db
    .collection("orders")
    .doc(orderId)
    .update({
      status: "verifying",
      receiptRef,
      history: FieldValue.arrayUnion({ status: "verifying", at: now, note: `Receipt submitted (${receiptRef})` }),
      updatedAt: now,
    });
  return json({ ok: true, status: "verifying" });
}
