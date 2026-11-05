import { NextRequest } from "next/server";
import { getAuthedUser, json, errorJson } from "@/lib/api-utils";
import { getAdminApp } from "@/lib/firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

/**
 * Bank references come in many shapes: "FT240812ABCD", "trx 9912 3344",
 * "0.00 ETB ...". We normalise whitespace/case but keep the value intact —
 * the reference is matched by a human against the bank statement, so we
 * never try to be clever about rewriting it.
 */
function normalizeRef(raw: string) {
  return raw.replace(/\s+/g, " ").trim().toUpperCase().slice(0, 64);
}

export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return errorJson("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  const { orderId } = body || {};
  const rawRef = body?.receiptRef;

  if (!orderId) return errorJson("Missing order");

  // Verification is image-first now: the receipt photo is what Jo checks, and
  // the bank reference is optional extra evidence when the customer has it.
  const receiptRef = typeof rawRef === "string" && rawRef.trim() ? normalizeRef(rawRef) : "";

  const admin = await getAdminApp();
  const db = getFirestore(admin);
  const orderDoc = await db.collection("orders").doc(orderId).get();
  if (!orderDoc.exists) return errorJson("Order not found", 404);
  const order = orderDoc.data()!;
  if (order.userId !== user.uid && !user.admin) return errorJson("Forbidden", 403);
  // `receipt_uploaded` must be allowed: attaching the image and submitting the
  // receipt are two calls now, and the image always lands first. Without it the
  // image-first flow died on a 409 right after a successful upload.
  if (!["awaiting_payment", "receipt_uploaded", "rejected"].includes(order.status)) {
    return errorJson("Order is not awaiting payment", 409);
  }

  // The image IS the verification now — no photo, nothing for Jo to check.
  if (!order.receiptData && !order.receiptUrl) {
    return errorJson("Upload the receipt image first");
  }

  // The customer must tell us which bank they actually paid from, so the
  // admin knows where to look. Default to the method chosen at checkout.
  const methodId =
    typeof body?.paymentMethodId === "string" && body.paymentMethodId
      ? body.paymentMethodId
      : (order.paymentMethodId || "");

  let methodName = order.paymentMethodName || "";
  let accountRef = "";

  if (methodId) {
    const settingsSnap = await db.collection("settings").doc("store").get();
    const methods = (settingsSnap.data()?.paymentMethods || []) as {
      id: string;
      name: string;
      type?: string;
      accountNumber?: string;
    }[];
    const method = methods.find((m) => m.id === methodId);

    if (!method) {
      return errorJson("That payment method is no longer available — contact the store", 409);
    }
    methodName = method.name;
    accountRef = method.accountNumber || "";

  }

  const now = Date.now();
  const isResubmission = order.status === "rejected";

  await db
    .collection("orders")
    .doc(orderId)
    .update({
      status: "verifying",
      receiptRef,
      // Recorded against the bank they claim to have used, so the admin desk
      // can match the reference in the right statement.
      receiptPaymentMethodId: methodId,
      receiptPaymentMethodName: methodName,
      receiptAccountRef: accountRef,
      // Kept for legacy orders; an image is now mandatory to get here.
      receiptMissing: false,
      submittedAt: now,
      ...(isResubmission ? { rejectionReason: FieldValue.delete() } : {}),
      history: FieldValue.arrayUnion({
        status: "verifying",
        at: now,
        note: `${isResubmission ? "Receipt re-submitted" : "Receipt submitted"}${
          methodName ? ` via ${methodName}` : ""
        }${receiptRef ? ` — ref ${receiptRef}` : ""}`,
      }),
      updatedAt: now,
    });

  return json({
    ok: true,
    status: "verifying",
    receiptRef,
    paymentMethodName: methodName,
    receiptMissing: false,
  });
}
