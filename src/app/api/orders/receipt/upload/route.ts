import { NextRequest } from "next/server";
import { getAuthedUser, json, errorJson } from "@/lib/api-utils";
import { getAdminApp } from "@/lib/firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

/**
 * Receipt upload — no Storage bucket involved.
 * The client compresses the image in the browser and POSTs a data URI:
 * body: { orderId, dataUri, name }
 * Validates ownership + shape, stores it inline, flips the order to receipt_uploaded.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return errorJson("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  const { orderId, dataUri, name } = body || {};
  if (!orderId) return errorJson("Missing orderId");
  if (typeof dataUri !== "string" || !dataUri.startsWith("data:image/")) {
    return errorJson("Receipt must be an image");
  }
  // Firestore doc limit is 1 MiB — receipt + order must coexist comfortably.
  if (dataUri.length > 900_000) {
    return errorJson("Receipt too large after compression — try a smaller photo", 413);
  }

  const db = getFirestore(await getAdminApp());
  const orderRef = db.collection("orders").doc(orderId);
  const orderDoc = await orderRef.get();
  if (!orderDoc.exists) return errorJson("Order not found", 404);
  const order = orderDoc.data()!;
  if (order.userId !== user.uid && !user.admin) return errorJson("Forbidden", 403);
  if (["confirmed", "shipped", "delivered"].includes(order.status)) {
    return errorJson("Payment already confirmed for this order", 409);
  }

  const now = Date.now();
  await orderRef.update({
    receiptData: dataUri,
    receiptName: name || "receipt",
    status: "receipt_uploaded",
    history: FieldValue.arrayUnion({
      status: "receipt_uploaded",
      at: now,
      note: `Receipt uploaded (${name || "file"})`,
    }),
    updatedAt: now,
  });

  return json({ ok: true, status: "receipt_uploaded" });
}
