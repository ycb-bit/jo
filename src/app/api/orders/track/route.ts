import { NextRequest } from "next/server";
import { getFirestore } from "firebase-admin/firestore";
import { getAdminApp } from "@/lib/firebase-admin";
import { json, errorJson } from "@/lib/api-utils";

export const runtime = "nodejs";

/**
 * Look an order up by its reference code (JO-29P753MB).
 *
 * The reference alone is not enough — anyone who saw a screenshot could use it
 * — so the customer has to give the email the order was placed with. The reply
 * is deliberately narrow: status, timeline, items and totals, never the
 * shipping address or the receipt image.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const rawRef = typeof body?.ref === "string" ? body.ref : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  const ref = rawRef.replace(/\s+/g, "").toUpperCase();
  if (ref.length < 4 || !email.includes("@")) {
    return errorJson("Enter your reference code and the email you ordered with");
  }

  const db = getFirestore(await getAdminApp());
  const snap = await db
    .collection("orders")
    .where("ref", "==", ref)
    .limit(1)
    .get();

  // One message for "no such order" and "wrong email" so the endpoint cannot be
  // used to discover which references exist.
  const notFound = () => errorJson("No order matches that reference and email", 404);

  if (snap.empty) return notFound();

  const doc = snap.docs[0];
  const order = doc.data() as Record<string, any>;
  if (String(order.email || "").toLowerCase() !== email) return notFound();

  return json({
    ref: order.ref,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    total: order.total,
    currency: order.currency,
    items: (order.items || []).map((it: Record<string, any>) => ({
      name: it.name,
      color: it.color,
      size: it.size,
      qty: it.qty,
      unitPrice: it.unitPrice,
    })),
    history: (order.history || []).map((h: Record<string, any>) => ({
      status: h.status,
      at: h.at,
      note: h.note,
    })),
    trackingNote: order.trackingNote || "",
    receiptSubmitted: !!order.receiptRef,
    rejectionReason: order.rejectionReason || "",
  });
}